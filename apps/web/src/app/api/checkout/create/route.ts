import { NextResponse } from "next/server";

import { getTrackingContextFromRequest, parseCookies } from "../../../../lib/analytics/session";
import { loadPublishedTestById } from "../../../../lib/content/provider";
import { RESULT_COOKIE, verifyResultCookie } from "../../../../lib/product/result_cookie";
import {
  DEFAULT_EVENT_BODY_BYTES,
  DEFAULT_EVENT_RATE_LIMIT,
  assertAllowedHost,
  assertAllowedMethod,
  assertAllowedOrigin,
  assertMaxBodyBytes,
  rateLimit,
  resolveRequestHost
} from "../../../../lib/security/request_guards";
import {
  DEFAULT_OFFER_KEY,
  getOffer,
  isOfferKey,
  requireStripePriceId,
  type OfferKey
} from "../../../../lib/pricing";
import { createStripeClient } from "../../../../lib/stripe/client";
import { assertStripeEnvConfigured } from "../../../../lib/stripe/env";
import { buildStripeMetadata } from "../../../../lib/stripe/metadata";
import { resolveLocale, resolveTenant } from "../../../../lib/tenants/resolve";
import eventsContract from "../../../../../../../analytics/events.json";

type EventsContract = {
  forbidden_properties: string[];
};

const REQUIRED_METADATA_KEYS = [
  "tenant_id",
  "test_id",
  "session_id",
  "distinct_id",
  "offer_key",
  "product_type",
  "credits_granted",
  "pricing_variant",
  "unit_price_eur",
  "currency",
  "purchase_id",
  "is_upsell"
] as const;

assertStripeEnvConfigured({
  context: "/api/checkout/create",
  required: ["STRIPE_SECRET_KEY"]
});

const normalizeKey = (value: string): string => value.trim().toLowerCase();

const forbiddenPatterns = (eventsContract as EventsContract).forbidden_properties.map(
  normalizeKey
);
const forbiddenExact = new Set(
  forbiddenPatterns.filter((pattern) => pattern && !pattern.includes("*"))
);
const forbiddenPrefixes = forbiddenPatterns
  .filter((pattern) => pattern.endsWith("*"))
  .map((pattern) => pattern.slice(0, -1));

const isForbiddenKey = (key: string): boolean => {
  const normalized = normalizeKey(key);
  if (forbiddenExact.has(normalized)) {
    return true;
  }

  return forbiddenPrefixes.some((prefix) => normalized.startsWith(prefix));
};

const requireString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const requireRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const requireStringRecord = (value: unknown): Record<string, string> | null => {
  const record = requireRecord(value);
  if (!record) {
    return null;
  }

  const output: Record<string, string> = {};
  for (const [key, entry] of Object.entries(record)) {
    if (typeof entry !== "string") {
      return null;
    }
    output[key] = entry;
  }

  return output;
};

const resolveMetadataMismatches = (
  provided: Record<string, string>,
  expected: Record<string, string>
): string[] => {
  const mismatches: string[] = [];

  for (const key of REQUIRED_METADATA_KEYS) {
    if (provided[key] !== expected[key]) {
      mismatches.push(key);
    }
  }

  return mismatches;
};

export const POST = async (request: Request): Promise<Response> => {
  const methodResponse = assertAllowedMethod(request, ["POST"]);
  if (methodResponse) {
    return methodResponse;
  }

  const hostResponse = assertAllowedHost(request);
  if (hostResponse) {
    return hostResponse;
  }

  const originResponse = assertAllowedOrigin(request);
  if (originResponse) {
    return originResponse;
  }

  const rateLimitResponse = rateLimit(request, DEFAULT_EVENT_RATE_LIMIT);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const bodyResponse = await assertMaxBodyBytes(request, DEFAULT_EVENT_BODY_BYTES);
  if (bodyResponse) {
    return bodyResponse;
  }

  let body: Record<string, unknown> | null = null;
  try {
    body = requireRecord(await request.json());
  } catch {
    body = null;
  }

  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const purchaseId = requireString(body.purchase_id);
  if (!purchaseId) {
    return NextResponse.json({ error: "purchase_id is required." }, { status: 400 });
  }

  const offerKeyInput = requireString(body.offer_key);
  let offerKey: OfferKey = DEFAULT_OFFER_KEY;
  if (offerKeyInput) {
    if (!isOfferKey(offerKeyInput)) {
      return NextResponse.json({ error: "Invalid offer_key." }, { status: 400 });
    }
    offerKey = offerKeyInput;
  }

  const offer = getOffer(offerKey);

  const stripeMetadata = requireStringRecord(body.stripe_metadata);
  if (!stripeMetadata) {
    return NextResponse.json({ error: "stripe_metadata is required." }, { status: 400 });
  }

  const forbiddenKeys = Object.keys(stripeMetadata).filter((key) => isForbiddenKey(key));
  if (forbiddenKeys.length > 0) {
    return NextResponse.json(
      { error: "stripe_metadata contains forbidden fields.", forbidden: forbiddenKeys },
      { status: 400 }
    );
  }

  const cookies = parseCookies(request.headers.get("cookie"));
  const resultCookieValue = cookies[RESULT_COOKIE];
  const resultPayload = resultCookieValue ? verifyResultCookie(resultCookieValue) : null;
  if (!resultPayload) {
    return NextResponse.json({ error: "Result cookie is required." }, { status: 401 });
  }

  const host = resolveRequestHost(request);
  if (!host) {
    return NextResponse.json({ error: "Host is required." }, { status: 400 });
  }

  const tenantResolution = resolveTenant(request.headers, host);
  if (tenantResolution.tenantId !== resultPayload.tenant_id) {
    return NextResponse.json(
      { error: "Result cookie does not match tenant." },
      { status: 400 }
    );
  }

  const published = await loadPublishedTestById(
    tenantResolution.tenantId,
    resultPayload.test_id,
    tenantResolution.defaultLocale ?? "en"
  );
  if (!published) {
    return NextResponse.json({ error: "Unknown test_id." }, { status: 400 });
  }
  const testSpec = published.spec;

  const locale = resolveLocale({
    defaultLocale: tenantResolution.defaultLocale,
    acceptLanguage: request.headers.get("accept-language")
  });
  const { utm, clickIds } = getTrackingContextFromRequest({
    cookies,
    url: new URL(request.url)
  });

  const stripeClient = createStripeClient();
  if (!stripeClient) {
    return NextResponse.json(
      { error: "Stripe secret key is not configured." },
      { status: 503 }
    );
  }

  let stripePriceId: string;
  try {
    stripePriceId = requireStripePriceId(offer);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Stripe price id is not configured for the selected offer.";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  const trustedMetadata = buildStripeMetadata({
    tenantId: resultPayload.tenant_id,
    testId: resultPayload.test_id,
    sessionId: resultPayload.session_id,
    distinctId: resultPayload.distinct_id,
    locale,
    utm,
    clickIds,
    offerKey: offer.offer_key,
    productType: offer.product_type,
    creditsGranted: offer.credits_granted,
    pricingVariant: offer.pricing_variant,
    unitPriceEur: offer.display_price_eur,
    currency: offer.currency,
    isUpsell: false,
    purchaseId
  });

  const trustedForbiddenKeys = Object.keys(trustedMetadata).filter((key) =>
    isForbiddenKey(key)
  );
  if (trustedForbiddenKeys.length > 0) {
    return NextResponse.json(
      {
        error: "stripe_metadata contains forbidden fields.",
        forbidden: trustedForbiddenKeys
      },
      { status: 400 }
    );
  }

  const metadataMismatches = resolveMetadataMismatches(stripeMetadata, trustedMetadata);
  if (metadataMismatches.length > 0) {
    return NextResponse.json(
      {
        error: "stripe_metadata does not match server context.",
        mismatched: metadataMismatches
      },
      { status: 400 }
    );
  }

  const successUrl = `https://${host}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `https://${host}/t/${testSpec.slug}/pay`;

  let session:
    | {
        id?: string | null;
        url?: string | null;
      }
    | null = null;

  try {
    session = await stripeClient.checkout.sessions.create({
      mode: "payment",
      client_reference_id: purchaseId,
      metadata: trustedMetadata,
      line_items: [
        {
          quantity: 1,
          price: stripePriceId
        }
      ],
      success_url: successUrl,
      cancel_url: cancelUrl
    });
  } catch {
    session = null;
  }

  if (!session?.url || !session?.id) {
    return NextResponse.json(
      { error: "Unable to create Stripe checkout session." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    checkout_url: session.url,
    stripe_session_id: session.id
  });
};

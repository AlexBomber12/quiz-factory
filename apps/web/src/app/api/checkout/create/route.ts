import { NextResponse } from "next/server";

import { getTrackingContextFromRequest, parseCookies } from "../../../../lib/analytics/session";
import { loadTestSpecById } from "../../../../lib/content/load";
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
import { createStripeClient } from "../../../../lib/stripe/client";
import { buildStripeMetadata } from "../../../../lib/stripe/metadata";
import { resolveLocale, resolveTenant } from "../../../../lib/tenants/resolve";
import eventsContract from "../../../../../../../analytics/events.json";

type EventsContract = {
  forbidden_properties: string[];
};

const PRODUCT_PRICES_EUR_CENTS = {
  single: 149,
  pack_5: 499,
  pack_10: 799
} as const;

const PRODUCT_LABELS: Record<keyof typeof PRODUCT_PRICES_EUR_CENTS, string> = {
  single: "Single report",
  pack_5: "Pack of 5 reports",
  pack_10: "Pack of 10 reports"
};

const PRICING_VARIANTS = new Set(["intro", "base"]);
const REQUIRED_METADATA_KEYS = [
  "tenant_id",
  "test_id",
  "session_id",
  "distinct_id",
  "product_type",
  "pricing_variant",
  "purchase_id",
  "is_upsell"
] as const;

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

  const productTypeRaw = requireString(body.product_type);
  if (!productTypeRaw || !(productTypeRaw in PRODUCT_PRICES_EUR_CENTS)) {
    return NextResponse.json({ error: "Invalid product_type." }, { status: 400 });
  }

  const pricingVariant = requireString(body.pricing_variant);
  if (!pricingVariant || !PRICING_VARIANTS.has(pricingVariant)) {
    return NextResponse.json({ error: "Invalid pricing_variant." }, { status: 400 });
  }

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

  let testSpec: ReturnType<typeof loadTestSpecById>;
  try {
    testSpec = loadTestSpecById(resultPayload.test_id);
  } catch {
    return NextResponse.json({ error: "Unknown test_id." }, { status: 400 });
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

  const productType = productTypeRaw as keyof typeof PRODUCT_PRICES_EUR_CENTS;
  const amount = PRODUCT_PRICES_EUR_CENTS[productType];
  const productLabel = PRODUCT_LABELS[productType];

  const trustedMetadata = buildStripeMetadata({
    tenantId: resultPayload.tenant_id,
    testId: resultPayload.test_id,
    sessionId: resultPayload.session_id,
    distinctId: resultPayload.distinct_id,
    locale,
    utm,
    clickIds,
    productType,
    pricingVariant,
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
          price_data: {
            currency: "eur",
            unit_amount: amount,
            product_data: {
              name: productLabel
            }
          }
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

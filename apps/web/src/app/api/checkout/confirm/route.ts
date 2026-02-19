import { NextResponse } from "next/server";

import { buildBaseEventProperties } from "@/lib/analytics/events";
import { recordAnalyticsEventToContentDb } from "@/lib/analytics/event_store";
import { capturePosthogEvent } from "@/lib/analytics/posthog";
import {
  normalizeString,
  parseCookies,
  type ClickIdParams,
  type UtmParams
} from "@/lib/analytics/session";
import { validateAnalyticsEventPayload } from "@/lib/analytics/validate";
import {
  CREDITS_COOKIE,
  CREDITS_COOKIE_TTL_SECONDS,
  grantCredits,
  hasGrantId,
  parseCreditsCookie,
  setLastGrantMetadata,
  serializeCreditsCookie
} from "@/lib/credits";
import { getOffer, isOfferKey } from "@/lib/pricing";
import {
  REPORT_TOKEN,
  type ReportTokenPayload,
  signReportToken
} from "@/lib/product/report_token";
import { sanitizeEnqueueReportJobInput } from "@/lib/report/report_job_inputs";
import { enqueueReportJob } from "@/lib/report/report_job_repo";
import {
  DEFAULT_EVENT_BODY_BYTES,
  DEFAULT_EVENT_RATE_LIMIT,
  assertAllowedHostAsync,
  assertAllowedMethod,
  assertAllowedOriginAsync,
  assertMaxBodyBytes,
  rateLimit
} from "@/lib/security/request_guards";
import { createStripeClient } from "@/lib/stripe/client";
import { assertStripeEnvConfigured } from "@/lib/stripe/env";
import { parseStripeMetadata } from "@/lib/stripe/metadata";

const REPORT_TOKEN_TTL_SECONDS = 60 * 60 * 24;

assertStripeEnvConfigured({
  context: "/api/checkout/confirm",
  required: ["STRIPE_SECRET_KEY"]
});

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

const toAmountEur = (amount: unknown): number | null => {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return null;
  }

  return Number((amount / 100).toFixed(2));
};

const isPaidSession = (session: {
  payment_status?: string | null;
  status?: string | null;
}): boolean => {
  const paymentStatus = normalizeString(session.payment_status);
  const status = normalizeString(session.status);
  return paymentStatus === "paid" || paymentStatus === "no_payment_required" || status === "complete";
};

export const POST = async (request: Request): Promise<Response> => {
  const methodResponse = assertAllowedMethod(request, ["POST"]);
  if (methodResponse) {
    return methodResponse;
  }

  const hostResponse = await assertAllowedHostAsync(request);
  if (hostResponse) {
    return hostResponse;
  }

  const originResponse = await assertAllowedOriginAsync(request);
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

  const stripeSessionId = requireString(body.stripe_session_id);
  if (!stripeSessionId) {
    return NextResponse.json(
      { error: "stripe_session_id is required." },
      { status: 400 }
    );
  }

  const stripeClient = createStripeClient();
  if (!stripeClient) {
    return NextResponse.json(
      { error: "Stripe secret key is not configured." },
      { status: 503 }
    );
  }

  let session: Awaited<ReturnType<typeof stripeClient.checkout.sessions.retrieve>>;
  try {
    session = await stripeClient.checkout.sessions.retrieve(stripeSessionId);
  } catch {
    return NextResponse.json(
      { error: "Unable to retrieve Stripe checkout session." },
      { status: 502 }
    );
  }

  if (!isPaidSession(session)) {
    return NextResponse.json(
      { error: "Checkout session is not paid." },
      { status: 400 }
    );
  }

  const metadata = parseStripeMetadata(session.metadata ?? null);
  const required: Record<string, string | null> = {
    purchase_id: metadata.purchase_id,
    tenant_id: metadata.tenant_id,
    test_id: metadata.test_id,
    session_id: metadata.session_id,
    distinct_id: metadata.distinct_id,
    locale: metadata.locale,
    product_type: metadata.product_type,
    pricing_variant: metadata.pricing_variant
  };

  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    return NextResponse.json(
      { error: "Stripe metadata is missing required fields.", missing },
      { status: 400 }
    );
  }

  const tenantId = required.tenant_id ?? "";
  const purchaseId = required.purchase_id ?? "";
  const testId = required.test_id ?? "";
  const sessionId = required.session_id ?? "";
  const distinctId = required.distinct_id ?? "";
  const locale = required.locale ?? "";
  const productType = required.product_type ?? "";
  const pricingVariant = required.pricing_variant ?? "";

  const creditsGranted = isOfferKey(metadata.offer_key)
    ? getOffer(metadata.offer_key).credits_granted
    : metadata.credits_granted ?? 0;
  const requestCookies = parseCookies(request.headers.get("cookie"));
  const creditsStateBefore = parseCreditsCookie(requestCookies, tenantId);
  const grantAlreadyApplied = hasGrantId(creditsStateBefore, purchaseId);

  const enqueueInput = sanitizeEnqueueReportJobInput({
    purchase_id: purchaseId,
    tenant_id: tenantId,
    test_id: testId,
    session_id: sessionId,
    locale
  });

  if (enqueueInput) {
    try {
      // Safe to attempt on every confirmation retry because enqueue is idempotent by purchase_id.
      await enqueueReportJob(enqueueInput);
    } catch {
      // Best-effort enqueue; checkout confirm must still succeed.
    }
  }

  const creditsStateAfterGrant = grantCredits(creditsStateBefore, creditsGranted, purchaseId);
  const creditsStateAfter = setLastGrantMetadata(creditsStateAfterGrant, {
    grant_id: purchaseId,
    offer_key: metadata.offer_key,
    product_type: productType,
    pricing_variant: pricingVariant
  });
  const creditsBalanceAfter = creditsStateAfter.credits_remaining;

  const amountEur = toAmountEur(session.amount_total);
  const currency = normalizeString(metadata.currency ?? session.currency);
  const utm: UtmParams = {
    utm_source: metadata.utm_source,
    utm_medium: metadata.utm_medium,
    utm_campaign: metadata.utm_campaign,
    utm_content: metadata.utm_content,
    utm_term: metadata.utm_term
  };
  const clickIds: ClickIdParams = {
    fbclid: metadata.fbclid,
    gclid: metadata.gclid,
    ttclid: metadata.ttclid
  };

  if (!grantAlreadyApplied && amountEur !== null && currency) {
    const analyticsProperties = buildBaseEventProperties({
      tenantId,
      sessionId,
      distinctId,
      testId,
      utm,
      clickIds,
      locale: metadata.locale,
      deviceType: metadata.device_type
    });

    analyticsProperties.purchase_id = purchaseId;
    analyticsProperties.amount_eur = amountEur;
    analyticsProperties.product_type = productType;
    analyticsProperties.payment_provider = "stripe";
    analyticsProperties.is_upsell = metadata.is_upsell ?? false;
    analyticsProperties.currency = currency.toUpperCase();
    analyticsProperties.offer_key = metadata.offer_key;
    analyticsProperties.credits_granted = creditsGranted;
    analyticsProperties.credits_balance_after = creditsBalanceAfter;
    analyticsProperties.pricing_variant = pricingVariant;
    analyticsProperties.unit_price_eur = metadata.unit_price_eur;
    analyticsProperties.event_id = `purchase_success:${purchaseId}`;

    const validation = validateAnalyticsEventPayload(
      "purchase_success",
      analyticsProperties as Record<string, unknown>
    );
    if (validation.ok) {
      void capturePosthogEvent("purchase_success", analyticsProperties).catch(() => null);
      void recordAnalyticsEventToContentDb("purchase_success", analyticsProperties).catch(
        () => null
      );
    }
  }

  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + REPORT_TOKEN_TTL_SECONDS * 1000);

  const payload: ReportTokenPayload = {
    purchase_id: purchaseId,
    tenant_id: tenantId,
    test_id: testId,
    session_id: sessionId,
    distinct_id: distinctId,
    product_type: productType,
    pricing_variant: pricingVariant,
    issued_at_utc: issuedAt.toISOString(),
    expires_at_utc: expiresAt.toISOString()
  };

  const reportToken = signReportToken(payload);
  const response = NextResponse.json({
    ok: true,
    purchase_id: payload.purchase_id,
    test_id: payload.test_id,
    credits_granted: creditsGranted,
    credits_balance_after: creditsBalanceAfter
  });

  response.cookies.set(REPORT_TOKEN, reportToken, {
    httpOnly: true,
    maxAge: REPORT_TOKEN_TTL_SECONDS,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production"
  });

  if (creditsGranted > 0) {
    response.cookies.set(CREDITS_COOKIE, serializeCreditsCookie(creditsStateAfter), {
      httpOnly: true,
      maxAge: CREDITS_COOKIE_TTL_SECONDS,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production"
    });
  }

  return response;
};

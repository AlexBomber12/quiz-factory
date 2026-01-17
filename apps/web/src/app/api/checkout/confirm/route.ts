import { NextResponse } from "next/server";

import { normalizeString } from "../../../../lib/analytics/session";
import {
  REPORT_TOKEN,
  type ReportTokenPayload,
  signReportToken
} from "../../../../lib/product/report_token";
import {
  DEFAULT_EVENT_BODY_BYTES,
  DEFAULT_EVENT_RATE_LIMIT,
  assertAllowedHost,
  assertAllowedMethod,
  assertAllowedOrigin,
  assertMaxBodyBytes,
  rateLimit
} from "../../../../lib/security/request_guards";
import { createStripeClient } from "../../../../lib/stripe/client";
import { parseStripeMetadata } from "../../../../lib/stripe/metadata";

const REPORT_TOKEN_TTL_SECONDS = 60 * 60 * 24;

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

  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + REPORT_TOKEN_TTL_SECONDS * 1000);

  const payload: ReportTokenPayload = {
    purchase_id: required.purchase_id ?? "",
    tenant_id: required.tenant_id ?? "",
    test_id: required.test_id ?? "",
    session_id: required.session_id ?? "",
    distinct_id: required.distinct_id ?? "",
    product_type: required.product_type ?? "",
    pricing_variant: required.pricing_variant ?? "",
    issued_at_utc: issuedAt.toISOString(),
    expires_at_utc: expiresAt.toISOString()
  };

  const reportToken = signReportToken(payload);
  const response = NextResponse.json({
    ok: true,
    purchase_id: payload.purchase_id,
    test_id: payload.test_id
  });

  response.cookies.set(REPORT_TOKEN, reportToken, {
    httpOnly: true,
    maxAge: REPORT_TOKEN_TTL_SECONDS,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production"
  });

  return response;
};

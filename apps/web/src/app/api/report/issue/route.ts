import { NextResponse } from "next/server";

import { parseCookies } from "../../../../lib/analytics/session";
import {
  CREDITS_COOKIE,
  CREDITS_COOKIE_TTL_SECONDS,
  createReportKey,
  parseCreditsCookie,
  serializeCreditsCookie,
  setLastGrantMetadata,
  type CreditsGrantMetadata
} from "../../../../lib/credits";
import { loadPublishedTestBySlug } from "../../../../lib/content/provider";
import {
  REPORT_TOKEN,
  type ReportTokenPayload,
  signReportToken
} from "../../../../lib/product/report_token";
import { RESULT_COOKIE, verifyResultCookie } from "../../../../lib/product/result_cookie";
import {
  DEFAULT_EVENT_BODY_BYTES,
  DEFAULT_EVENT_RATE_LIMIT,
  assertAllowedHostAsync,
  assertAllowedMethod,
  assertAllowedOriginAsync,
  assertMaxBodyBytes,
  rateLimit
} from "../../../../lib/security/request_guards";
import { resolveTenantContext } from "../../../../lib/tenants/request";

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

  const slug = requireString(body.slug);
  if (!slug) {
    return NextResponse.json({ error: "slug is required." }, { status: 400 });
  }

  const context = await resolveTenantContext();
  const published = await loadPublishedTestBySlug(context.tenantId, slug, context.locale);
  if (!published) {
    return NextResponse.json({ error: "Test not available." }, { status: 404 });
  }
  const testId = published.test_id;

  const cookieRecord = parseCookies(request.headers.get("cookie"));
  const resultCookieValue = cookieRecord[RESULT_COOKIE] ?? null;
  const resultPayload = resultCookieValue ? verifyResultCookie(resultCookieValue) : null;

  if (!resultPayload) {
    return NextResponse.json({ error: "Result not available." }, { status: 401 });
  }

  if (resultPayload.tenant_id !== context.tenantId || resultPayload.test_id !== testId) {
    return NextResponse.json({ error: "Result does not match this tenant." }, { status: 403 });
  }

  const creditsState = parseCreditsCookie(cookieRecord, context.tenantId);
  const reportKey = createReportKey(context.tenantId, testId, resultPayload.session_id);
  const hasAccess =
    creditsState.credits_remaining > 0 ||
    creditsState.consumed_report_keys.includes(reportKey);

  if (!hasAccess) {
    return NextResponse.json(
      {
        error: "Insufficient credits.",
        paywall_url: `/t/${slug}/pay`
      },
      { status: 402 }
    );
  }

  let grant = creditsState.last_grant;
  let nextCreditsState = creditsState;
  let shouldPersistCreditsState = false;

  if (!grant && creditsState.grant_ids.length > 0) {
    const fallbackGrant: CreditsGrantMetadata = {
      grant_id: creditsState.grant_ids[0],
      offer_key: null,
      product_type: "single",
      pricing_variant: "base"
    };
    nextCreditsState = setLastGrantMetadata(creditsState, fallbackGrant);
    grant = nextCreditsState.last_grant;
    shouldPersistCreditsState = true;
  }

  if (!grant) {
    return NextResponse.json(
      { error: "No purchase metadata available. Please complete checkout again." },
      { status: 409 }
    );
  }

  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + REPORT_TOKEN_TTL_SECONDS * 1000);

  const payload: ReportTokenPayload = {
    purchase_id: grant.grant_id,
    tenant_id: context.tenantId,
    test_id: testId,
    session_id: resultPayload.session_id,
    distinct_id: resultPayload.distinct_id,
    product_type: grant.product_type,
    pricing_variant: grant.pricing_variant,
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

  if (shouldPersistCreditsState) {
    response.cookies.set(CREDITS_COOKIE, serializeCreditsCookie(nextCreditsState), {
      httpOnly: true,
      maxAge: CREDITS_COOKIE_TTL_SECONDS,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production"
    });
  }

  return response;
};

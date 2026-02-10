import { NextResponse } from "next/server";

import { getDistinctIdFromRequest, parseCookies } from "../../../../lib/analytics/session";
import { loadPublishedTestById } from "../../../../lib/content/provider";
import { signResultCookie, RESULT_COOKIE } from "../../../../lib/product/result_cookie";
import { scoreTest } from "../../../../lib/product/scoring";
import { upsertAttemptSummary } from "../../../../lib/report/attempt_summary_repo";
import { sanitizeAttemptSummaryInput } from "../../../../lib/report/report_job_inputs";
import {
  DEFAULT_EVENT_BODY_BYTES,
  DEFAULT_EVENT_RATE_LIMIT,
  assertAllowedHost,
  assertAllowedMethod,
  assertAllowedOrigin,
  assertMaxBodyBytes,
  rateLimit
} from "../../../../lib/security/request_guards";
import {
  assertAttemptTokenMatchesContext,
  verifyAttemptToken
} from "../../../../lib/security/attempt_token";
import { resolveTenant } from "../../../../lib/tenants/resolve";

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

  const testId = requireString(body.test_id);
  if (!testId) {
    return NextResponse.json({ error: "test_id is required." }, { status: 400 });
  }

  const sessionId = requireString(body.session_id);
  if (!sessionId) {
    return NextResponse.json({ error: "session_id is required." }, { status: 400 });
  }

  const attemptToken = requireString(body.attempt_token);
  if (!attemptToken) {
    return NextResponse.json({ error: "Attempt token is required." }, { status: 401 });
  }

  const answers = requireRecord(body.answers);
  if (!answers) {
    return NextResponse.json({ error: "answers is required." }, { status: 400 });
  }

  const cookies = parseCookies(request.headers.get("cookie"));
  const distinctId = getDistinctIdFromRequest({ body, cookies });
  if (!distinctId) {
    return NextResponse.json({ error: "Distinct id is required." }, { status: 401 });
  }

  const { tenantId, defaultLocale } = resolveTenant(
    request.headers,
    new URL(request.url).hostname
  );
  const locale = defaultLocale ?? "en";

  let verifiedToken: ReturnType<typeof verifyAttemptToken>;
  try {
    verifiedToken = verifyAttemptToken(attemptToken);
  } catch {
    return NextResponse.json({ error: "Attempt token is invalid." }, { status: 401 });
  }

  try {
    assertAttemptTokenMatchesContext(verifiedToken, {
      tenant_id: tenantId,
      session_id: sessionId,
      distinct_id: distinctId
    });
  } catch {
    return NextResponse.json(
      { error: "Attempt token does not match request context." },
      { status: 401 }
    );
  }

  const published = await loadPublishedTestById(
    tenantId,
    testId,
    locale
  );
  if (!published) {
    return NextResponse.json({ error: "Unknown test_id." }, { status: 400 });
  }
  const testSpec = published.spec;

  let scoring: ReturnType<typeof scoreTest>;
  try {
    scoring = scoreTest(testSpec, answers);
  } catch {
    return NextResponse.json({ error: "Invalid answers." }, { status: 400 });
  }

  const computedAtUtc = new Date().toISOString();
  const attemptSummaryInput = sanitizeAttemptSummaryInput({
    tenant_id: tenantId,
    test_id: testId,
    session_id: sessionId,
    distinct_id: distinctId,
    locale,
    computed_at: computedAtUtc,
    band_id: scoring.band_id,
    scale_scores: scoring.scale_scores,
    total_score: scoring.total_score
  });

  if (attemptSummaryInput) {
    try {
      await upsertAttemptSummary(attemptSummaryInput);
    } catch {
      // Best-effort write; preview should still succeed without DB.
    }
  }

  const resultCookie = signResultCookie({
    tenant_id: tenantId,
    session_id: sessionId,
    distinct_id: distinctId,
    test_id: testId,
    computed_at_utc: computedAtUtc,
    band_id: scoring.band_id,
    scale_scores: scoring.scale_scores
  });

  const response = NextResponse.json({
    test_id: testId,
    band_id: scoring.band_id,
    scale_scores: scoring.scale_scores
  });

  response.cookies.set(RESULT_COOKIE, resultCookie, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production"
  });

  return response;
};

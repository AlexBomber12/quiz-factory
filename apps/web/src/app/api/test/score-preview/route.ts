import { NextResponse } from "next/server";

import { getDistinctIdFromRequest, parseCookies } from "../../../../lib/analytics/session";
import { loadTestSpecById } from "../../../../lib/content/load";
import { signResultCookie, RESULT_COOKIE } from "../../../../lib/product/result_cookie";
import { scoreTest } from "../../../../lib/product/scoring";
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

  const { tenantId } = resolveTenant(request.headers, new URL(request.url).host);

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

  let testSpec: ReturnType<typeof loadTestSpecById>;
  try {
    testSpec = loadTestSpecById(testId);
  } catch {
    return NextResponse.json({ error: "Unknown test_id." }, { status: 400 });
  }

  let scoring: ReturnType<typeof scoreTest>;
  try {
    scoring = scoreTest(testSpec, answers);
  } catch {
    return NextResponse.json({ error: "Invalid answers." }, { status: 400 });
  }

  const resultCookie = signResultCookie({
    tenant_id: tenantId,
    session_id: sessionId,
    distinct_id: distinctId,
    test_id: testId,
    computed_at_utc: new Date().toISOString(),
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

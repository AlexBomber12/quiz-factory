import { NextResponse } from "next/server";

import { parseCookies } from "../../../../lib/analytics/session";
import {
  CREDITS_COOKIE,
  CREDITS_COOKIE_TTL_SECONDS,
  consumeCreditForReport,
  createReportKey,
  parseCreditsCookie,
  serializeCreditsCookie
} from "../../../../lib/credits";
import { getTenantTestIds, resolveTestIdBySlug } from "../../../../lib/content/catalog";
import { loadLocalizedTest } from "../../../../lib/content/load";
import { REPORT_TOKEN, verifyReportToken } from "../../../../lib/product/report_token";
import { RESULT_COOKIE, verifyResultCookie } from "../../../../lib/product/result_cookie";
import { verifyReportLinkToken } from "../../../../lib/report_link_token";
import {
  DEFAULT_EVENT_BODY_BYTES,
  DEFAULT_EVENT_RATE_LIMIT,
  assertAllowedHost,
  assertAllowedMethod,
  assertAllowedOrigin,
  assertMaxBodyBytes,
  rateLimit
} from "../../../../lib/security/request_guards";
import { resolveTenantContext } from "../../../../lib/tenants/request";

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

const resolveReportTestId = (slug: string, tenantId: string): string | null => {
  const testId = resolveTestIdBySlug(slug);
  if (!testId) {
    return null;
  }

  const allowedTests = getTenantTestIds(tenantId);
  if (!allowedTests.includes(testId)) {
    return null;
  }

  return testId;
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

  const slug = requireString(body.slug);
  if (!slug) {
    return NextResponse.json({ error: "slug is required." }, { status: 400 });
  }

  const context = await resolveTenantContext();
  const testId = resolveReportTestId(slug, context.tenantId);
  if (!testId) {
    return NextResponse.json({ error: "Test not available." }, { status: 404 });
  }

  const url = new URL(request.url);
  const reportLinkTokenValue =
    requireString(body.report_link_token) ?? requireString(url.searchParams.get("t"));
  let reportLinkPayload: ReturnType<typeof verifyReportLinkToken> | null = null;
  if (reportLinkTokenValue) {
    try {
      reportLinkPayload = verifyReportLinkToken(reportLinkTokenValue);
    } catch {
      reportLinkPayload = null;
    }
  }

  const cookieRecord = parseCookies(request.headers.get("cookie"));
  const reportTokenValue = cookieRecord[REPORT_TOKEN] ?? null;
  const resultCookieValue = cookieRecord[RESULT_COOKIE] ?? null;
  const reportPayload = reportTokenValue ? verifyReportToken(reportTokenValue) : null;
  const resultPayload = resultCookieValue ? verifyResultCookie(resultCookieValue) : null;

  if (reportLinkTokenValue) {
    if (!reportLinkPayload) {
      return NextResponse.json({ error: "Report access is invalid." }, { status: 403 });
    }

    if (
      reportLinkPayload.tenant_id !== context.tenantId ||
      reportLinkPayload.test_id !== testId
    ) {
      return NextResponse.json({ error: "Report access is invalid." }, { status: 403 });
    }

    const reportKey = createReportKey(
      context.tenantId,
      testId,
      reportLinkPayload.session_id
    );
    if (reportKey !== reportLinkPayload.report_key) {
      return NextResponse.json({ error: "Report access is invalid." }, { status: 403 });
    }

    const test = loadLocalizedTest(testId, reportLinkPayload.locale);
    const band = test.result_bands.find(
      (candidate) => candidate.band_id === reportLinkPayload.band_id
    );
    const bandCopy = band?.copy[test.locale];

    if (!band || !bandCopy) {
      return NextResponse.json({ error: "Report content unavailable." }, { status: 404 });
    }

    const scaleEntries = Object.entries(reportLinkPayload.scale_scores)
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([scale, value]) => ({ scale, value }));
    const totalScore = scaleEntries.reduce((sum, entry) => sum + entry.value, 0);
    const creditsState = parseCreditsCookie(cookieRecord, context.tenantId);

    return NextResponse.json({
      ok: true,
      report: {
        test_id: test.test_id,
        slug: test.slug,
        report_title: test.report_title,
        band: {
          headline: bandCopy.headline,
          summary: bandCopy.summary,
          bullets: bandCopy.bullets
        },
        scale_entries: scaleEntries,
        total_score: totalScore
      },
      purchase_id: reportLinkPayload.purchase_id,
      session_id: reportLinkPayload.session_id,
      credits_balance_after: creditsState.credits_remaining,
      consumed_credit: false
    });
  }

  const hasCookiePayloads = Boolean(reportPayload && resultPayload);
  const matchesContext =
    reportPayload &&
    resultPayload &&
    reportPayload.tenant_id === context.tenantId &&
    reportPayload.test_id === testId &&
    resultPayload.tenant_id === reportPayload.tenant_id &&
    resultPayload.test_id === reportPayload.test_id &&
    resultPayload.session_id === reportPayload.session_id &&
    resultPayload.distinct_id === reportPayload.distinct_id;

  if (matchesContext) {
    const reportKey = createReportKey(
      context.tenantId,
      testId,
      reportPayload.session_id
    );
    const creditsState = parseCreditsCookie(cookieRecord, context.tenantId);
    const alreadyConsumed = creditsState.consumed_report_keys.includes(reportKey);

    let nextCreditsState = creditsState;
    let consumedCredit = false;

    if (!alreadyConsumed) {
      const consumeResult = consumeCreditForReport(creditsState, reportKey);
      if (!consumeResult.consumed) {
        return NextResponse.json(
          {
            error: "Insufficient credits.",
            paywall_url: `/t/${slug}/pay`
          },
          { status: 402 }
        );
      }

      nextCreditsState = consumeResult.new_state;
      consumedCredit = true;
    }

    const test = loadLocalizedTest(testId, context.locale);
    const band = test.result_bands.find(
      (candidate) => candidate.band_id === resultPayload.band_id
    );
    const bandCopy = band?.copy[test.locale];

    if (!band || !bandCopy) {
      return NextResponse.json({ error: "Report content unavailable." }, { status: 404 });
    }

    const scaleEntries = Object.entries(resultPayload.scale_scores)
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([scale, value]) => ({ scale, value }));
    const totalScore = scaleEntries.reduce((sum, entry) => sum + entry.value, 0);

    const response = NextResponse.json({
      ok: true,
      report: {
        test_id: test.test_id,
        slug: test.slug,
        report_title: test.report_title,
        band: {
          headline: bandCopy.headline,
          summary: bandCopy.summary,
          bullets: bandCopy.bullets
        },
        scale_entries: scaleEntries,
        total_score: totalScore
      },
      purchase_id: reportPayload.purchase_id,
      session_id: reportPayload.session_id,
      credits_balance_after: nextCreditsState.credits_remaining,
      consumed_credit: consumedCredit
    });

    response.cookies.set(CREDITS_COOKIE, serializeCreditsCookie(nextCreditsState), {
      httpOnly: true,
      maxAge: CREDITS_COOKIE_TTL_SECONDS,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production"
    });

    return response;
  }

  if (!hasCookiePayloads) {
    return NextResponse.json({ error: "Report is locked." }, { status: 401 });
  }

  return NextResponse.json({ error: "Report access is invalid." }, { status: 403 });
};

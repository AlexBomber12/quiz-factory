import { NextResponse } from "next/server";

import { handleAnalyticsEvent } from "@/lib/analytics/server";
import { parseCookies } from "@/lib/analytics/session";
import { createReportKey } from "@/lib/credits";
import { loadPublishedTestById } from "@/lib/content/provider";
import { REPORT_TOKEN, verifyReportToken } from "@/lib/product/report_token";
import { RESULT_COOKIE, verifyResultCookie } from "@/lib/product/result_cookie";
import {
  cleanupExpiredCacheEntries,
  readReportPdfCache,
  resolveReportPdfTemplateVersion,
  writeReportPdfCache
} from "@/lib/report/pdf_cache";
import { resolveReportPdfMode } from "@/lib/report/pdf_mode";
import { renderReportPdf } from "@/lib/report/pdf_renderer";
import {
  DEFAULT_EVENT_BODY_BYTES,
  DEFAULT_EVENT_RATE_LIMIT,
  assertAllowedHostAsync,
  assertAllowedMethod,
  assertAllowedOriginAsync,
  assertMaxBodyBytes,
  rateLimit
} from "@/lib/security/request_guards";
import { resolveTenantContext } from "@/lib/tenants/request";

type ReportPdfRequestBody = {
  test_id?: unknown;
  purchase_id?: unknown;
};

const requireString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseReportPdfBody = async (
  request: Request
): Promise<{ testId: string | null; purchaseId: string | null }> => {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return { testId: null, purchaseId: null };
  }

  let parsed: ReportPdfRequestBody | null = null;
  try {
    parsed = (await request.json()) as ReportPdfRequestBody;
  } catch {
    parsed = null;
  }

  return {
    testId: requireString(parsed?.test_id),
    purchaseId: requireString(parsed?.purchase_id)
  };
};

const appendSetCookieHeaders = (target: Headers, source: Headers): void => {
  for (const cookie of source.getSetCookie()) {
    target.append("set-cookie", cookie);
  }
};

const buildErrorResponse = (
  status: number,
  message: string,
  analyticsResponse: Response
): Response => {
  const response = NextResponse.json({ error: message }, { status });
  appendSetCookieHeaders(response.headers, analyticsResponse.headers);
  return response;
};

const buildPdfResponse = (
  buffer: Buffer,
  filename: string,
  analyticsResponse: Response
): Response => {
  const body = new Uint8Array(buffer);
  const headers = new Headers({
    "content-type": "application/pdf",
    "content-disposition": `attachment; filename="${filename}"`,
    "content-length": String(buffer.byteLength)
  });
  appendSetCookieHeaders(headers, analyticsResponse.headers);
  return new Response(body, { status: 200, headers });
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

  const analyticsRequest = request.clone();
  const bodyRequest = request.clone();
  const body = await parseReportPdfBody(bodyRequest);
  const pdfMode = resolveReportPdfMode();

  const analyticsResponse = await handleAnalyticsEvent(analyticsRequest, {
    event: "report_pdf_download",
    requirePurchaseId: true
  });

  if (pdfMode !== "server") {
    return analyticsResponse;
  }

  if (!analyticsResponse.ok) {
    return analyticsResponse;
  }

  if (!body.testId || !body.purchaseId) {
    return buildErrorResponse(400, "test_id and purchase_id are required.", analyticsResponse);
  }

  const context = await resolveTenantContext();
  const published = await loadPublishedTestById(context.tenantId, body.testId, context.locale);
  if (!published) {
    return buildErrorResponse(404, "Test not available.", analyticsResponse);
  }
  const spec = published.spec;

  const cookieRecord = parseCookies(request.headers.get("cookie"));
  const reportTokenValue = cookieRecord[REPORT_TOKEN] ?? null;
  const resultCookieValue = cookieRecord[RESULT_COOKIE] ?? null;
  const reportPayload = reportTokenValue ? verifyReportToken(reportTokenValue) : null;
  const resultPayload = resultCookieValue ? verifyResultCookie(resultCookieValue) : null;

  if (!reportPayload || !resultPayload || !reportTokenValue || !resultCookieValue) {
    return buildErrorResponse(401, "Report is locked.", analyticsResponse);
  }

  const matchesContext =
    reportPayload.tenant_id === context.tenantId &&
    reportPayload.test_id === body.testId &&
    reportPayload.purchase_id === body.purchaseId &&
    resultPayload.tenant_id === reportPayload.tenant_id &&
    resultPayload.test_id === reportPayload.test_id &&
    resultPayload.session_id === reportPayload.session_id &&
    resultPayload.distinct_id === reportPayload.distinct_id;

  if (!matchesContext) {
    return buildErrorResponse(403, "Report access is invalid.", analyticsResponse);
  }

  const reportKey = createReportKey(context.tenantId, body.testId, reportPayload.session_id);
  const reportTemplateVersion = resolveReportPdfTemplateVersion(spec.version);

  void cleanupExpiredCacheEntries();

  const cacheParts = {
    tenantId: context.tenantId,
    testId: body.testId,
    reportKey,
    locale: context.locale,
    reportTemplateVersion
  };

  const cached = await readReportPdfCache(cacheParts);
  if (cached) {
    return buildPdfResponse(cached.buffer, `${spec.slug}-report.pdf`, analyticsResponse);
  }

  const origin = new URL(request.url).origin;
  const printUrl = new URL(`/report/${spec.slug}/print`, origin).toString();

  try {
    const pdfBuffer = await renderReportPdf({
      url: printUrl,
      locale: context.locale,
      cookies: [
        { name: REPORT_TOKEN, value: reportTokenValue },
        { name: RESULT_COOKIE, value: resultCookieValue }
      ]
    });

    await writeReportPdfCache(cacheParts, pdfBuffer);

    return buildPdfResponse(pdfBuffer, `${spec.slug}-report.pdf`, analyticsResponse);
  } catch {
    return buildErrorResponse(500, "Failed to generate PDF.", analyticsResponse);
  }
};

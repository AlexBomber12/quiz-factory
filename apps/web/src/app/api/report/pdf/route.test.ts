import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type CacheParts = {
  tenantId: string;
  testId: string;
  reportKey: string;
  locale: string;
  reportTemplateVersion: string;
};

const {
  headerValues,
  handleAnalyticsEventMock,
  cacheStore,
  cleanupExpiredCacheEntriesMock,
  resolveReportPdfTemplateVersionMock,
  readReportPdfCacheMock,
  writeReportPdfCacheMock,
  renderReportPdfMock
} = vi.hoisted(() => {
  const headerValues: Record<string, string> = {};
  const handleAnalyticsEventMock = vi.fn();
  const cacheStore = new Map<string, Buffer>();
  const cacheKeyForParts = (parts: CacheParts): string =>
    [parts.tenantId, parts.testId, parts.reportKey, parts.locale, parts.reportTemplateVersion].join(
      "|"
    );

  const cleanupExpiredCacheEntriesMock = vi.fn(async () => undefined);
  const resolveReportPdfTemplateVersionMock = vi.fn((specVersion: number) =>
    `template-${specVersion}`
  );
  const readReportPdfCacheMock = vi.fn(async (parts: CacheParts) => {
    const key = cacheKeyForParts(parts);
    const buffer = cacheStore.get(key);
    if (!buffer) {
      return null;
    }
    return {
      buffer,
      cachePath: key,
      ageSeconds: 0
    };
  });
  const writeReportPdfCacheMock = vi.fn(async (parts: CacheParts, buffer: Buffer) => {
    const key = cacheKeyForParts(parts);
    cacheStore.set(key, buffer);
    return key;
  });

  const renderReportPdfMock = vi.fn();

  return {
    headerValues,
    handleAnalyticsEventMock,
    cacheStore,
    cleanupExpiredCacheEntriesMock,
    resolveReportPdfTemplateVersionMock,
    readReportPdfCacheMock,
    writeReportPdfCacheMock,
    renderReportPdfMock
  };
});

vi.mock("next/headers", () => ({
  headers: () => new Headers(headerValues)
}));

vi.mock("../../../../lib/analytics/server", () => ({
  handleAnalyticsEvent: handleAnalyticsEventMock
}));

vi.mock("../../../../lib/report/pdf_cache", () => ({
  cleanupExpiredCacheEntries: cleanupExpiredCacheEntriesMock,
  readReportPdfCache: readReportPdfCacheMock,
  resolveReportPdfTemplateVersion: resolveReportPdfTemplateVersionMock,
  writeReportPdfCache: writeReportPdfCacheMock
}));

vi.mock("../../../../lib/report/pdf_renderer", () => ({
  renderReportPdf: renderReportPdfMock
}));

import { POST } from "./route";
import { resetRateLimitState } from "@/lib/security/request_guards";
import { resolveTestIdBySlug } from "@/lib/content/catalog";
import { loadLocalizedTest } from "@/lib/content/load";
import { REPORT_TOKEN, signReportToken } from "@/lib/product/report_token";
import { RESULT_COOKIE, signResultCookie } from "@/lib/product/result_cookie";
import {
  DISTINCT_COOKIE_NAME,
  SESSION_COOKIE_NAME
} from "@/lib/analytics/session";

const HOST = "tenant.example.com";
const TENANT_ID = "tenant-tenant-example-com";
const SLUG = "focus-rhythm";
const SESSION_ID = "session-report-pdf-123";
const DISTINCT_ID = "distinct-report-pdf-123";
const PURCHASE_ID = "purchase-report-pdf-123";

const TEST_ID = resolveTestIdBySlug(SLUG);
if (!TEST_ID) {
  throw new Error(`Missing test fixture for slug: ${SLUG}`);
}

const localizedTest = loadLocalizedTest(TEST_ID, "en");
const BAND_ID = localizedTest.result_bands[0]?.band_id;
if (!BAND_ID) {
  throw new Error(`Missing band fixture for test: ${TEST_ID}`);
}
const SCALE_ID = localizedTest.scoring.scales[0] ?? "scale";

const setHeaders = (values: Record<string, string>) => {
  for (const key of Object.keys(headerValues)) {
    delete headerValues[key];
  }
  Object.assign(headerValues, values);
};

const createAnalyticsResponse = (): Response => {
  const headers = new Headers({
    "content-type": "application/json"
  });
  headers.append("set-cookie", `${SESSION_COOKIE_NAME}=${SESSION_ID}; Path=/; HttpOnly`);
  headers.append("set-cookie", `${DISTINCT_COOKIE_NAME}=${DISTINCT_ID}; Path=/; HttpOnly`);

  return new Response(
    JSON.stringify({
      session_id: SESSION_ID,
      tenant_id: TENANT_ID
    }),
    {
      status: 200,
      headers
    }
  );
};

const createReportToken = (): string => {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + 24 * 60 * 60 * 1000);
  return signReportToken({
    purchase_id: PURCHASE_ID,
    tenant_id: TENANT_ID,
    test_id: TEST_ID,
    session_id: SESSION_ID,
    distinct_id: DISTINCT_ID,
    product_type: "pack_5",
    pricing_variant: "base",
    issued_at_utc: issuedAt.toISOString(),
    expires_at_utc: expiresAt.toISOString()
  });
};

const createResultCookie = (): string => {
  return signResultCookie({
    tenant_id: TENANT_ID,
    session_id: SESSION_ID,
    distinct_id: DISTINCT_ID,
    test_id: TEST_ID,
    computed_at_utc: new Date().toISOString(),
    band_id: BAND_ID,
    scale_scores: {
      [SCALE_ID]: 4
    }
  });
};

const buildRequest = (cookieHeader: string) =>
  new Request("https://tenant.example.com/api/report/pdf", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: HOST,
      origin: "https://tenant.example.com",
      "accept-language": "en",
      cookie: cookieHeader
    },
    body: JSON.stringify({
      test_id: TEST_ID,
      purchase_id: PURCHASE_ID
    })
  });

describe("POST /api/report/pdf", () => {
  beforeEach(() => {
    resetRateLimitState();
    cacheStore.clear();
    vi.clearAllMocks();
    setHeaders({
      host: HOST,
      "x-forwarded-proto": "https",
      "accept-language": "en"
    });
    process.env.REPORT_TOKEN_SECRET = "test-report-token-secret";
    process.env.RESULT_COOKIE_SECRET = "test-result-cookie-secret";
    delete process.env.REPORT_PDF_MODE;

    handleAnalyticsEventMock.mockImplementation(() => createAnalyticsResponse());
    renderReportPdfMock.mockResolvedValue(Buffer.from("pdf-server"));
  });

  afterEach(() => {
    delete process.env.REPORT_TOKEN_SECRET;
    delete process.env.RESULT_COOKIE_SECRET;
    delete process.env.REPORT_PDF_MODE;
    setHeaders({});
  });

  it("returns analytics response in client mode", async () => {
    const reportToken = createReportToken();
    const resultCookie = createResultCookie();
    const cookieHeader = [
      `${SESSION_COOKIE_NAME}=${SESSION_ID}`,
      `${DISTINCT_COOKIE_NAME}=${DISTINCT_ID}`,
      `${REPORT_TOKEN}=${reportToken}`,
      `${RESULT_COOKIE}=${resultCookie}`
    ].join("; ");

    const response = await POST(buildRequest(cookieHeader));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(handleAnalyticsEventMock).toHaveBeenCalledOnce();
    expect(renderReportPdfMock).not.toHaveBeenCalled();
    expect(readReportPdfCacheMock).not.toHaveBeenCalled();
    expect(writeReportPdfCacheMock).not.toHaveBeenCalled();
  });

  it("generates and caches pdfs in server mode", async () => {
    process.env.REPORT_PDF_MODE = "server";

    const reportToken = createReportToken();
    const resultCookie = createResultCookie();
    const cookieHeader = [
      `${SESSION_COOKIE_NAME}=${SESSION_ID}`,
      `${DISTINCT_COOKIE_NAME}=${DISTINCT_ID}`,
      `${REPORT_TOKEN}=${reportToken}`,
      `${RESULT_COOKIE}=${resultCookie}`
    ].join("; ");

    const firstResponse = await POST(buildRequest(cookieHeader));
    const secondResponse = await POST(buildRequest(cookieHeader));

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.headers.get("content-type")).toContain("application/pdf");
    expect(secondResponse.headers.get("content-type")).toContain("application/pdf");

    expect(handleAnalyticsEventMock).toHaveBeenCalledTimes(2);
    expect(readReportPdfCacheMock).toHaveBeenCalledTimes(2);
    expect(renderReportPdfMock).toHaveBeenCalledTimes(1);
    expect(writeReportPdfCacheMock).toHaveBeenCalledTimes(1);

    const renderArgs = renderReportPdfMock.mock.calls[0]?.[0] as {
      url: string;
      locale: string;
      cookies: Array<{ name: string; value: string }>;
    };
    expect(renderArgs.url).toBe("https://tenant.example.com/report/focus-rhythm/print");
    expect(renderArgs.locale).toBe("en");
    expect(renderArgs.cookies).toEqual([
      { name: REPORT_TOKEN, value: reportToken },
      { name: RESULT_COOKIE, value: resultCookie }
    ]);

    const setCookieValues = firstResponse.headers.getSetCookie();
    const setCookieJoined = setCookieValues.join(";");
    expect(setCookieJoined).toContain(SESSION_COOKIE_NAME);
    expect(setCookieJoined).toContain(DISTINCT_COOKIE_NAME);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let headerValues: Record<string, string> = {};

vi.mock("next/headers", () => ({
  headers: () => new Headers(headerValues)
}));

import { POST } from "./route";
import { resetRateLimitState } from "../../../../lib/security/request_guards";
import { resolveTestIdBySlug } from "../../../../lib/content/catalog";
import { loadLocalizedTest } from "../../../../lib/content/load";
import {
  CREDITS_COOKIE,
  consumeCreditForReport,
  createReportKey,
  grantCredits,
  parseCreditsCookie,
  serializeCreditsCookie,
  setLastGrantMetadata
} from "../../../../lib/credits";
import {
  REPORT_TOKEN,
  signReportToken,
  type ReportTokenPayload
} from "../../../../lib/product/report_token";
import { RESULT_COOKIE, signResultCookie } from "../../../../lib/product/result_cookie";
import { issueReportLinkToken } from "../../../../lib/report_link_token";

const HOST = "tenant.example.com";
const TENANT_ID = "tenant-tenant-example-com";
const SLUG = "focus-rhythm";
const SESSION_ID = "session-access-123";
const DISTINCT_ID = "distinct-access-123";
const PURCHASE_ID = "purchase-access-123";

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
const REPORT_KEY = createReportKey(TENANT_ID, TEST_ID, SESSION_ID);

const setHeaders = (values: Record<string, string>) => {
  headerValues = values;
};

const buildRequest = (cookieHeader: string, reportLinkToken?: string) => {
  const url = reportLinkToken
    ? `https://tenant.example.com/api/report/access?t=${encodeURIComponent(
        reportLinkToken
      )}`
    : "https://tenant.example.com/api/report/access";

  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: HOST,
      "accept-language": "en",
      cookie: cookieHeader
    },
    body: JSON.stringify({ slug: SLUG })
  });
};

const createResultCookie = (): string =>
  signResultCookie({
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

const createReportToken = (): string => {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + 60 * 60 * 24 * 1000);
  const payload: ReportTokenPayload = {
    purchase_id: PURCHASE_ID,
    tenant_id: TENANT_ID,
    test_id: TEST_ID,
    session_id: SESSION_ID,
    distinct_id: DISTINCT_ID,
    product_type: "pack_5",
    pricing_variant: "base",
    issued_at_utc: issuedAt.toISOString(),
    expires_at_utc: expiresAt.toISOString()
  };

  return signReportToken(payload);
};

const createReportLinkToken = (reportKey: string): string => {
  const expiresAt = new Date(Date.now() + 60 * 60 * 24 * 1000);

  return issueReportLinkToken({
    tenant_id: TENANT_ID,
    test_id: TEST_ID,
    report_key: reportKey,
    locale: "en",
    expires_at: expiresAt,
    purchase_id: PURCHASE_ID,
    session_id: SESSION_ID,
    band_id: BAND_ID,
    computed_at_utc: new Date().toISOString(),
    scale_scores: {
      [SCALE_ID]: 4
    }
  });
};

const createCreditsState = (credits: number) => {
  const baseState = parseCreditsCookie({}, TENANT_ID);
  const granted = grantCredits(baseState, credits, PURCHASE_ID);
  return setLastGrantMetadata(granted, {
    grant_id: PURCHASE_ID,
    offer_key: "pack5",
    product_type: "pack_5",
    pricing_variant: "base"
  });
};

const extractCookieValue = (setCookieHeader: string, cookieName: string): string | null => {
  const match = setCookieHeader.match(new RegExp(`${cookieName}=([^;]+)`));
  return match?.[1] ?? null;
};

describe("POST /api/report/access", () => {
  beforeEach(() => {
    resetRateLimitState();
    setHeaders({
      host: HOST,
      "x-forwarded-proto": "https",
      "accept-language": "en"
    });
    process.env.REPORT_TOKEN_SECRET = "test-report-token-secret";
    process.env.RESULT_COOKIE_SECRET = "test-result-cookie-secret";
  });

  afterEach(() => {
    delete process.env.REPORT_TOKEN_SECRET;
    delete process.env.RESULT_COOKIE_SECRET;
  });

  it("consumes one credit for a new report", async () => {
    const creditsState = createCreditsState(2);
    const cookieHeader = [
      `${REPORT_TOKEN}=${createReportToken()}`,
      `${RESULT_COOKIE}=${createResultCookie()}`,
      `${CREDITS_COOKIE}=${serializeCreditsCookie(creditsState)}`
    ].join("; ");

    const response = await POST(buildRequest(cookieHeader));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.consumed_credit).toBe(true);
    expect(payload.credits_balance_after).toBe(1);

    const setCookie = response.headers.get("set-cookie") ?? "";
    const creditsCookieValue = extractCookieValue(setCookie, CREDITS_COOKIE);
    expect(creditsCookieValue).toBeTruthy();

    const parsed = parseCreditsCookie({ [CREDITS_COOKIE]: creditsCookieValue ?? "" }, TENANT_ID);
    expect(parsed.credits_remaining).toBe(1);
    expect(parsed.consumed_report_keys).toContain(REPORT_KEY);
  });

  it("allows reopening an already consumed report without credits", async () => {
    const consumedState = consumeCreditForReport(createCreditsState(1), REPORT_KEY).new_state;
    const cookieHeader = [
      `${REPORT_TOKEN}=${createReportToken()}`,
      `${RESULT_COOKIE}=${createResultCookie()}`,
      `${CREDITS_COOKIE}=${serializeCreditsCookie(consumedState)}`
    ].join("; ");

    const response = await POST(buildRequest(cookieHeader));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.consumed_credit).toBe(false);
    expect(payload.credits_balance_after).toBe(0);
  });

  it("returns 402 when credits are exhausted and the report is not consumed", async () => {
    const cookieHeader = [
      `${REPORT_TOKEN}=${createReportToken()}`,
      `${RESULT_COOKIE}=${createResultCookie()}`
    ].join("; ");

    const response = await POST(buildRequest(cookieHeader));

    expect(response.status).toBe(402);
    const payload = await response.json();
    expect(payload.error).toBe("Insufficient credits.");
  });

  it("allows access with a valid report link token when cookies are missing", async () => {
    const response = await POST(buildRequest("", createReportLinkToken(REPORT_KEY)));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.purchase_id).toBe(PURCHASE_ID);
    expect(payload.session_id).toBe(SESSION_ID);
    expect(payload.consumed_credit).toBe(false);
  });

  it("rejects report link tokens with mismatched report keys", async () => {
    const response = await POST(buildRequest("", createReportLinkToken("wrong-report-key")));

    expect(response.status).toBe(403);
    const payload = await response.json();
    expect(payload.error).toBe("Report access is invalid.");
  });
});

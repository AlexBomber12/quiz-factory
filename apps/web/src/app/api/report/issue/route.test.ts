import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let headerValues: Record<string, string> = {};

vi.mock("next/headers", () => ({
  headers: () => new Headers(headerValues)
}));

import { POST } from "./route";
import { resetRateLimitState } from "../../../../lib/security/request_guards";
import { resolveTestIdBySlug } from "../../../../lib/content/catalog";
import { loadLocalizedTest } from "../../../../lib/content/load";
import { RESULT_COOKIE, signResultCookie } from "../../../../lib/product/result_cookie";
import {
  CREDITS_COOKIE,
  grantCredits,
  parseCreditsCookie,
  serializeCreditsCookie,
  setLastGrantMetadata
} from "../../../../lib/credits";
import { REPORT_TOKEN } from "../../../../lib/product/report_token";

const HOST = "tenant.example.com";
const TENANT_ID = "tenant-tenant-example-com";
const SLUG = "focus-rhythm";
const SESSION_ID = "session-issue-123";
const DISTINCT_ID = "distinct-issue-123";
const PURCHASE_ID = "purchase-issue-123";

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
  headerValues = values;
};

const buildRequest = (cookieHeader: string) =>
  new Request("https://tenant.example.com/api/report/issue", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: HOST,
      "accept-language": "en",
      cookie: cookieHeader
    },
    body: JSON.stringify({ slug: SLUG })
  });

const createResultCookie = (): string =>
  signResultCookie({
    tenant_id: TENANT_ID,
    session_id: SESSION_ID,
    distinct_id: DISTINCT_ID,
    test_id: TEST_ID,
    computed_at_utc: new Date().toISOString(),
    band_id: BAND_ID,
    scale_scores: {
      [SCALE_ID]: 3
    }
  });

const createCreditsCookie = (): string => {
  const baseState = parseCreditsCookie({}, TENANT_ID);
  const granted = grantCredits(baseState, 5, PURCHASE_ID);
  const withMetadata = setLastGrantMetadata(granted, {
    grant_id: PURCHASE_ID,
    offer_key: "pack5",
    product_type: "pack_5",
    pricing_variant: "base"
  });
  return serializeCreditsCookie(withMetadata);
};

describe("POST /api/report/issue", () => {
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

  it("issues a report token when credits are available", async () => {
    const resultCookie = createResultCookie();
    const creditsCookie = createCreditsCookie();
    const cookieHeader = `${RESULT_COOKIE}=${resultCookie}; ${CREDITS_COOKIE}=${creditsCookie}`;

    const response = await POST(buildRequest(cookieHeader));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      ok: true,
      purchase_id: PURCHASE_ID,
      test_id: TEST_ID
    });

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${REPORT_TOKEN}=`);
  });

  it("returns 402 when credits are not available", async () => {
    const resultCookie = createResultCookie();
    const cookieHeader = `${RESULT_COOKIE}=${resultCookie}`;

    const response = await POST(buildRequest(cookieHeader));

    expect(response.status).toBe(402);
    const payload = await response.json();
    expect(payload.error).toBe("Insufficient credits.");
  });
});

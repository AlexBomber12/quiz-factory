import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  type ReportTokenPayload,
  signReportToken,
  verifyReportToken
} from "./report_token";

describe("report token", () => {
  beforeEach(() => {
    process.env.REPORT_TOKEN_SECRET = "test-report-token-secret";
  });

  afterEach(() => {
    delete process.env.REPORT_TOKEN_SECRET;
  });

  it("signs and verifies payloads", () => {
    const now = new Date();
    const payload: ReportTokenPayload = {
      purchase_id: "purchase-1",
      tenant_id: "tenant-1",
      test_id: "test-demo",
      session_id: "session-1",
      distinct_id: "distinct-1",
      product_type: "single",
      pricing_variant: "intro",
      issued_at_utc: now.toISOString(),
      expires_at_utc: new Date(now.getTime() + 60_000).toISOString()
    };

    const signed = signReportToken(payload);
    const verified = verifyReportToken(signed);

    expect(verified).toEqual(payload);
  });

  it("rejects expired tokens", () => {
    const now = new Date();
    const payload: ReportTokenPayload = {
      purchase_id: "purchase-2",
      tenant_id: "tenant-2",
      test_id: "test-demo",
      session_id: "session-2",
      distinct_id: "distinct-2",
      product_type: "single",
      pricing_variant: "intro",
      issued_at_utc: new Date(now.getTime() - 120_000).toISOString(),
      expires_at_utc: new Date(now.getTime() - 60_000).toISOString()
    };

    const signed = signReportToken(payload);
    const verified = verifyReportToken(signed);

    expect(verified).toBeNull();
  });
});

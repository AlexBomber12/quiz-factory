import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { issueReportLinkToken, verifyReportLinkToken } from "./report_link_token";

describe("report link token", () => {
  beforeEach(() => {
    process.env.REPORT_TOKEN_SECRET = "test-report-token-secret";
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.REPORT_TOKEN_SECRET;
  });

  it("issues and verifies tokens", () => {
    const expiresAt = new Date(Date.now() + 60_000);

    const token = issueReportLinkToken({
      tenant_id: "tenant-1",
      test_id: "test-1",
      report_key: "tenant-1:test-1:session-1",
      locale: "en",
      expires_at: expiresAt,
      purchase_id: "purchase-1",
      session_id: "session-1",
      band_id: "band-1",
      computed_at_utc: new Date().toISOString(),
      scale_scores: {
        focus: 4,
        rhythm: 6
      }
    });

    const payload = verifyReportLinkToken(token);

    expect(payload.tenant_id).toBe("tenant-1");
    expect(payload.test_id).toBe("test-1");
    expect(payload.report_key).toBe("tenant-1:test-1:session-1");
    expect(payload.locale).toBe("en");
    expect(payload.purchase_id).toBe("purchase-1");
    expect(payload.session_id).toBe("session-1");
    expect(payload.band_id).toBe("band-1");
    expect(payload.scale_scores).toEqual({ focus: 4, rhythm: 6 });
    expect(payload.exp).toBe(Math.floor(expiresAt.getTime() / 1000));
  });

  it("rejects expired tokens", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));

    const token = issueReportLinkToken({
      tenant_id: "tenant-1",
      test_id: "test-1",
      report_key: "tenant-1:test-1:session-1",
      locale: "en",
      expires_at: new Date("2024-01-01T00:00:01Z"),
      purchase_id: "purchase-1",
      session_id: "session-1",
      band_id: "band-1",
      computed_at_utc: "2024-01-01T00:00:00Z",
      scale_scores: {
        focus: 4
      }
    });

    vi.setSystemTime(new Date("2024-01-01T00:00:02Z"));
    expect(() => verifyReportLinkToken(token)).toThrow("Report link token has expired.");
  });
});

import { describe, expect, it } from "vitest";

import { validateAnalyticsEventPayload } from "./validate";

const basePayload = {
  tenant_id: "tenant-demo",
  session_id: "session-123",
  distinct_id: "distinct-123",
  timestamp_utc: "2024-01-01T00:00:00.000Z",
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_content: null,
  utm_term: null,
  referrer: null,
  country: null,
  language: null,
  device_type: null
};

describe("analytics validation", () => {
  it("rejects forbidden keys", () => {
    const result = validateAnalyticsEventPayload("page_view", {
      ...basePayload,
      card_number: "4242"
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("forbidden_properties");
      expect(result.error.details?.forbidden).toContain("card_number");
    }
  });

  it("rejects missing required fields", () => {
    const payload: Record<string, unknown> = {
      ...basePayload,
      session_id: undefined
    };
    const result = validateAnalyticsEventPayload("page_view", payload);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("missing_required");
      expect(result.error.details?.missing).toContain("session_id");
    }
  });

  it("accepts a minimal payload", () => {
    const result = validateAnalyticsEventPayload("page_view", basePayload);

    expect(result.ok).toBe(true);
  });
});

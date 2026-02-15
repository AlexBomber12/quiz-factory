import { describe, expect, it } from "vitest";

import type { AnalyticsEventProperties } from "./events";
import { mapAnalyticsEventToContentDbRow } from "./event_store";

const baseProperties: AnalyticsEventProperties = {
  event_id: "evt-123",
  tenant_id: "tenant-demo",
  tenant_kind: "hub",
  session_id: "session-123",
  distinct_id: "distinct-123",
  test_id: "test-123",
  timestamp_utc: "2026-01-15T12:00:00.000Z",
  utm_source: "google",
  utm_medium: "cpc",
  utm_campaign: "winter",
  utm_content: null,
  utm_term: null,
  referrer: "https://example.com",
  country: "US",
  language: "en",
  device_type: "desktop",
  locale: "en-US",
  page_type: "landing"
};

describe("mapAnalyticsEventToContentDbRow", () => {
  it("derives occurred_date from occurred_at in UTC", () => {
    const row = mapAnalyticsEventToContentDbRow("page_view", {
      ...baseProperties,
      timestamp_utc: "2026-01-15T23:30:00-02:00"
    });

    expect(row).not.toBeNull();
    expect(row?.occurred_date).toBe("2026-01-16");
  });

  it("stores optional fields as null when they are blank", () => {
    const row = mapAnalyticsEventToContentDbRow("page_view", {
      ...baseProperties,
      test_id: " ",
      locale: "",
      device_type: "   ",
      page_type: "",
      utm_source: "",
      utm_campaign: " ",
      referrer: "",
      country: " "
    });

    expect(row).toMatchObject({
      test_id: null,
      locale: null,
      device_type: null,
      page_type: null,
      utm_source: null,
      utm_campaign: null,
      referrer: null,
      country: null
    });
  });

  it("returns null when required identity fields are missing", () => {
    const requiredFields = ["tenant_id", "session_id", "distinct_id"] as const;

    for (const field of requiredFields) {
      const result = mapAnalyticsEventToContentDbRow("page_view", {
        ...baseProperties,
        [field]: " "
      } as AnalyticsEventProperties);

      expect(result).toBeNull();
    }
  });
});

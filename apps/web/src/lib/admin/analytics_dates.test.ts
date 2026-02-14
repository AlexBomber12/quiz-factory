import { describe, expect, it } from "vitest";

import {
  formatDateYYYYMMDD,
  getDefaultAnalyticsDateRange,
  parseDateYYYYMMDD,
  resolveAnalyticsDateRange
} from "./analytics_dates";

describe("analytics_dates", () => {
  it("formats dates in YYYY-MM-DD", () => {
    expect(formatDateYYYYMMDD(new Date(Date.UTC(2026, 1, 14, 22, 11, 5)))).toBe("2026-02-14");
  });

  it("parses valid YYYY-MM-DD strings", () => {
    const parsed = parseDateYYYYMMDD("2026-02-14");
    expect(parsed?.toISOString()).toBe("2026-02-14T00:00:00.000Z");
  });

  it("rejects invalid date strings", () => {
    expect(parseDateYYYYMMDD("2026-2-14")).toBeNull();
    expect(parseDateYYYYMMDD("2026-02-30")).toBeNull();
    expect(parseDateYYYYMMDD("not-a-date")).toBeNull();
  });

  it("computes default date range as last 7 days inclusive", () => {
    expect(getDefaultAnalyticsDateRange(new Date(Date.UTC(2026, 1, 14, 23, 59, 59)))).toEqual({
      start: "2026-02-08",
      end: "2026-02-14"
    });
  });

  it("uses defaults when query range is missing or invalid", () => {
    const now = new Date(Date.UTC(2026, 1, 14, 0, 0, 0));
    expect(resolveAnalyticsDateRange({ start: "2026-02-10" }, now)).toEqual({
      start: "2026-02-08",
      end: "2026-02-14"
    });
    expect(resolveAnalyticsDateRange({ start: "2026-02-14", end: "2026-02-10" }, now)).toEqual({
      start: "2026-02-08",
      end: "2026-02-14"
    });
  });

  it("uses provided range when both values are valid", () => {
    expect(resolveAnalyticsDateRange({ start: "2026-02-10", end: "2026-02-14" })).toEqual({
      start: "2026-02-10",
      end: "2026-02-14"
    });
  });
});

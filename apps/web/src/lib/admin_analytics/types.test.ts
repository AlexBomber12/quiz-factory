import { describe, expect, it } from "vitest";

import { parseAdminAnalyticsFilters } from "./types";

const NOW = new Date(Date.UTC(2026, 1, 14, 12, 0, 0));

describe("parseAdminAnalyticsFilters", () => {
  it("parses valid filters and normalizes optional strings", () => {
    const parsed = parseAdminAnalyticsFilters(
      new URLSearchParams([
        ["start", "2026-02-01"],
        ["end", "2026-02-07"],
        ["tenant_id", " tenant-quizfactory-en "],
        ["test_id", "test-focus-rhythm"],
        ["locale", "es"],
        ["device_type", "mobile"],
        ["utm_source", " meta "]
      ]),
      NOW
    );

    expect(parsed).toEqual({
      ok: true,
      value: {
        start: "2026-02-01",
        end: "2026-02-07",
        tenant_id: "tenant-quizfactory-en",
        test_id: "test-focus-rhythm",
        locale: "es",
        device_type: "mobile",
        utm_source: "meta"
      }
    });
  });

  it("uses default date range when start/end are omitted", () => {
    const parsed = parseAdminAnalyticsFilters(new URLSearchParams(), NOW);

    expect(parsed).toEqual({
      ok: true,
      value: {
        start: "2026-02-08",
        end: "2026-02-14",
        tenant_id: null,
        test_id: null,
        locale: "all",
        device_type: "all",
        utm_source: null
      }
    });
  });

  it("returns an error when only one date bound is provided", () => {
    const parsed = parseAdminAnalyticsFilters(
      new URLSearchParams([
        ["start", "2026-02-01"]
      ]),
      NOW
    );

    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      return;
    }

    expect(parsed.errors).toContainEqual({
      field: "params",
      message: "start and end must both be provided when either one is set"
    });
  });

  it("returns errors for invalid date format and order", () => {
    const invalidFormat = parseAdminAnalyticsFilters(
      new URLSearchParams([
        ["start", "2026/02/01"],
        ["end", "2026-02-07"]
      ]),
      NOW
    );

    expect(invalidFormat.ok).toBe(false);
    if (!invalidFormat.ok) {
      expect(invalidFormat.errors).toContainEqual({
        field: "start",
        message: "must match YYYY-MM-DD"
      });
    }

    const invalidRange = parseAdminAnalyticsFilters(
      new URLSearchParams([
        ["start", "2026-02-10"],
        ["end", "2026-02-07"]
      ]),
      NOW
    );

    expect(invalidRange.ok).toBe(false);
    if (!invalidRange.ok) {
      expect(invalidRange.errors).toContainEqual({
        field: "params",
        message: "start must be on or before end"
      });
    }
  });

  it("validates enum filters", () => {
    const parsed = parseAdminAnalyticsFilters(
      new URLSearchParams([
        ["locale", "de"],
        ["device_type", "watch"]
      ]),
      NOW
    );

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors).toContainEqual({
        field: "locale",
        message: "must be one of all, en, es, pt-BR"
      });
      expect(parsed.errors).toContainEqual({
        field: "device_type",
        message: "must be one of all, desktop, mobile, tablet"
      });
    }
  });

  it("rejects control characters and overlong optional filters", () => {
    const overlong = "x".repeat(121);
    const parsed = parseAdminAnalyticsFilters(
      new URLSearchParams([
        ["tenant_id", overlong],
        ["utm_source", "good\u0000bad"]
      ]),
      NOW
    );

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors).toContainEqual({
        field: "tenant_id",
        message: "must be 120 characters or fewer"
      });
      expect(parsed.errors).toContainEqual({
        field: "utm_source",
        message: "contains control characters"
      });
    }
  });
});

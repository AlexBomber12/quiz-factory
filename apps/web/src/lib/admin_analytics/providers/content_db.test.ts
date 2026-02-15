import { describe, expect, it } from "vitest";

import {
  buildContentDbEventFilterClause,
  buildContentDbStripeFilterClause,
  safeRatio
} from "./content_db";
import type { AdminAnalyticsFilters } from "../types";

const FILTERS: AdminAnalyticsFilters = {
  start: "2026-02-01",
  end: "2026-02-07",
  tenant_id: "tenant-quizfactory-en",
  test_id: "test-focus-rhythm",
  locale: "en",
  device_type: "mobile",
  utm_source: "meta"
};

describe("safeRatio", () => {
  it("returns 0 when denominator is zero", () => {
    expect(safeRatio(10, 0)).toBe(0);
  });

  it("returns a rounded ratio for valid inputs", () => {
    expect(safeRatio(1, 3)).toBe(0.3333);
  });
});

describe("buildContentDbEventFilterClause", () => {
  it("includes all supported filters by default", () => {
    const clause = buildContentDbEventFilterClause(FILTERS);

    expect(clause.whereSql).toContain("ae.occurred_date >= $1::date");
    expect(clause.whereSql).toContain("ae.tenant_id = $3");
    expect(clause.whereSql).toContain("ae.test_id = $4");
    expect(clause.whereSql).toContain("ae.locale = $5");
    expect(clause.whereSql).toContain("ae.device_type = $6");
    expect(clause.whereSql).toContain("ae.utm_source = $7");
    expect(clause.params).toEqual([
      "2026-02-01",
      "2026-02-07",
      "tenant-quizfactory-en",
      "test-focus-rhythm",
      "en",
      "mobile",
      "meta"
    ]);
  });

  it("can omit the test filter for detail helper queries", () => {
    const clause = buildContentDbEventFilterClause(FILTERS, {
      includeTestFilter: false
    });

    expect(clause.whereSql).not.toContain("ae.test_id =");
  });
});

describe("buildContentDbStripeFilterClause", () => {
  it("adds a device-based EXISTS predicate when supported", () => {
    const clause = buildContentDbStripeFilterClause(FILTERS, {
      alias: "sp",
      canFilterByDeviceType: true
    });

    expect(clause.whereSql).toContain("EXISTS (");
    expect(clause.whereSql).toContain("ae_device.device_type = $7");
  });

  it("forces an empty result when device filtering cannot be applied", () => {
    const clause = buildContentDbStripeFilterClause(FILTERS, {
      canFilterByDeviceType: false
    });

    expect(clause.whereSql).toContain("1 = 0");
  });
});

import { describe, expect, it } from "vitest";

import {
  ContentDbAdminAnalyticsProvider,
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

type QueryCall = {
  query: string;
  values: unknown[];
};

const makeProviderWithQueryResolver = (
  resolveRows: (query: string, values: unknown[]) => Array<Record<string, unknown>>
): { provider: ContentDbAdminAnalyticsProvider; calls: QueryCall[] } => {
  const calls: QueryCall[] = [];
  const client = {
    query: async (text: string, values: unknown[] = []) => {
      calls.push({ query: text, values });
      return {
        rows: resolveRows(text, values),
        rowCount: null
      };
    }
  };

  return {
    provider: new ContentDbAdminAnalyticsProvider(client),
    calls
  };
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

describe("ContentDbAdminAnalyticsProvider regressions", () => {
  it("counts distinct sessions in traffic breakdown aggregation", async () => {
    const { provider, calls } = makeProviderWithQueryResolver((query) => {
      if (query.includes("information_schema.tables")) {
        return [
          { table_name: "analytics_events" }
        ];
      }

      return [];
    });

    await provider.getTraffic(FILTERS, { top_n: 5 });

    const trafficQuery = calls.find((entry) =>
      entry.query.includes("segment_metrics AS (")
    )?.query;

    expect(trafficQuery).toContain(
      "COUNT(DISTINCT event_sessions.session_id) AS sessions"
    );
  });

  it("preserves stripe purchase timestamp for freshness lag", async () => {
    const { provider, calls } = makeProviderWithQueryResolver((query) => {
      if (query.includes("information_schema.tables")) {
        return [
          { table_name: "analytics_events" },
          { table_name: "stripe_purchases" }
        ];
      }

      if (query.includes("SELECT MAX(sp.created_utc) AS last_loaded_utc")) {
        return [{ last_loaded_utc: "2026-02-07T12:34:56.000Z" }];
      }

      return [];
    });

    const payload = await provider.getDataHealth(FILTERS);

    const stripeFreshness = payload.freshness.find(
      (row) => row.table === "stripe_purchases"
    );
    expect(stripeFreshness?.last_loaded_utc).toBe("2026-02-07T12:34:56.000Z");
    expect(
      calls.some((entry) => entry.query.includes("SELECT MAX(sp.created_utc) AS last_loaded_utc"))
    ).toBe(true);
    expect(
      calls.some((entry) => entry.query.includes("MAX(fp.purchase_date)::text"))
    ).toBe(false);
  });

  it("uses full tenant revenue for distribution row totals, not only top-test columns", async () => {
    const { provider } = makeProviderWithQueryResolver((query) => {
      if (query.includes("information_schema.tables")) {
        return [
          { table_name: "analytics_events" },
          { table_name: "stripe_purchases" }
        ];
      }

      if (query.includes("CONCAT(ae.tenant_id, '::', ae.test_id)") && query.includes("AS pair_key")) {
        return [
          { pair_key: "tenant-quizfactory-en::test-focus-rhythm", sessions: 10 },
          { pair_key: "tenant-quizfactory-en::test-energy-balance", sessions: 5 }
        ];
      }

      if (query.includes("CONCAT(fp.tenant_id, '::', fp.test_id)") && query.includes("AS pair_key")) {
        return [
          {
            pair_key: "tenant-quizfactory-en::test-focus-rhythm",
            purchases: 2,
            net_revenue_eur: 100
          },
          {
            pair_key: "tenant-quizfactory-en::test-energy-balance",
            purchases: 1,
            net_revenue_eur: 50
          }
        ];
      }

      return [];
    });

    const payload = await provider.getDistribution(FILTERS, {
      top_tenants: 1,
      top_tests: 1
    });

    expect(payload.row_order).toEqual(["tenant-quizfactory-en"]);
    expect(payload.column_order).toEqual(["test-focus-rhythm"]);
    expect(payload.rows["tenant-quizfactory-en"]?.net_revenue_eur_7d).toBe(150);
  });
});

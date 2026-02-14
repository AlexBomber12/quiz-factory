import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BigQueryAdminAnalyticsProvider,
  buildMartFilterClause,
  __resetBigQueryProviderCachesForTests
} from "./bigquery";
import type { AdminAnalyticsFilters } from "../types";

type QueryCall = {
  query: string;
  params: Record<string, unknown>;
};

const FILTERS: AdminAnalyticsFilters = {
  start: "2026-02-01",
  end: "2026-02-07",
  tenant_id: "tenant-quizfactory-en",
  test_id: "test-focus-rhythm",
  locale: "en",
  device_type: "mobile",
  utm_source: "meta"
};

const makeProvider = (
  resolveRows: (query: string) => Array<Record<string, unknown>> | Promise<Array<Record<string, unknown>>>
): { provider: BigQueryAdminAnalyticsProvider; calls: QueryCall[] } => {
  const calls: QueryCall[] = [];
  const bigquery = {
    createQueryJob: vi.fn(async (options: { query: string; params?: Record<string, unknown> }) => {
      calls.push({
        query: options.query,
        params: options.params ?? {}
      });
      const job = {
        getQueryResults: async () => [await resolveRows(options.query)] as [Array<Record<string, unknown>>]
      };
      return [job] as [typeof job, ...unknown[]];
    })
  };

  return {
    provider: new BigQueryAdminAnalyticsProvider(bigquery, "quiz-factory-analytics", {
      stripe: "raw_stripe",
      rawCosts: "raw_costs",
      tmp: "tmp",
      marts: "marts"
    }),
    calls
  };
};

const rowsForOverview = (query: string): Array<Record<string, unknown>> => {
  if (query.includes("FROM `quiz-factory-analytics.marts.mart_funnel_daily`") && query.includes("funnel_agg")) {
    return [
      {
        sessions: 120,
        test_starts: 80,
        test_completes: 60,
        paywall_views: 50,
        checkout_starts: 40,
        purchases: 20,
        paid_conversion: 0.1667,
        gross_revenue_eur: 1000,
        net_revenue_eur: 800,
        refunds_eur: 70,
        disputes_eur: 30,
        payment_fees_eur: 100
      }
    ];
  }

  if (query.includes("COALESCE(SUM(visits), 0) AS value")) {
    return [
      { date: "2026-02-01", value: 55 },
      { date: "2026-02-02", value: 65 }
    ];
  }

  if (query.includes("COALESCE(SUM(net_revenue_eur), 0) AS value")) {
    return [
      { date: "2026-02-01", value: 320 },
      { date: "2026-02-02", value: 480 }
    ];
  }

  if (query.includes("ORDER BY net_revenue_eur DESC, purchase_conversion DESC")) {
    return [
      {
        test_id: "test-focus-rhythm",
        net_revenue_eur: 700,
        purchases: 18,
        purchase_conversion: 0.2
      }
    ];
  }

  if (query.includes("ORDER BY net_revenue_eur DESC, tenant_id ASC")) {
    return [
      {
        tenant_id: "tenant-quizfactory-en",
        net_revenue_eur: 760,
        purchases: 19
      }
    ];
  }

  if (query.includes("CAST(MAX(date) AS STRING)") && query.includes("mart_funnel_daily")) {
    return [{ max_date: "2026-02-07" }];
  }

  if (query.includes("CAST(MAX(date) AS STRING)") && query.includes("mart_pnl_daily")) {
    return [{ max_date: "2026-02-07" }];
  }

  if (query.includes("CAST(MAX(date) AS STRING)") && query.includes("mart_unit_econ_daily")) {
    return [{ max_date: "2026-02-06" }];
  }

  if (query.includes("FROM `quiz-factory-analytics.marts.alert_events`")) {
    return [
      {
        detected_at_utc: "2026-02-07T15:00:00.000Z",
        alert_name: "conversion_drop",
        severity: "warn",
        tenant_id: "tenant-quizfactory-en",
        metric_value: 0.12,
        threshold_value: 0.15
      }
    ];
  }

  return [];
};

describe("buildMartFilterClause", () => {
  it("includes only date filters by default", () => {
    const filters: AdminAnalyticsFilters = {
      start: "2026-02-01",
      end: "2026-02-07",
      tenant_id: null,
      test_id: null,
      locale: "all",
      device_type: "all",
      utm_source: null
    };

    const result = buildMartFilterClause(filters);

    expect(result.whereSql).toContain("date BETWEEN DATE(@start_date) AND DATE(@end_date)");
    expect(result.whereSql).not.toContain("tenant_id = @tenant_id");
    expect(result.params).toEqual({
      start_date: "2026-02-01",
      end_date: "2026-02-07"
    });
  });

  it("adds tenant, test, locale, and utm filters when provided", () => {
    const result = buildMartFilterClause(FILTERS);

    expect(result.whereSql).toContain("tenant_id = @tenant_id");
    expect(result.whereSql).toContain("test_id = @test_id");
    expect(result.whereSql).toContain("locale = @locale");
    expect(result.whereSql).toContain("channel_key");
    expect(result.params).toMatchObject({
      start_date: FILTERS.start,
      end_date: FILTERS.end,
      tenant_id: FILTERS.tenant_id,
      test_id: FILTERS.test_id,
      locale: FILTERS.locale,
      utm_source: FILTERS.utm_source
    });
  });
});

describe("BigQueryAdminAnalyticsProvider.getOverview", () => {
  beforeEach(() => {
    __resetBigQueryProviderCachesForTests();
  });

  it("maps filters into mart queries and returns overview payload", async () => {
    const { provider, calls } = makeProvider(rowsForOverview);

    const overview = await provider.getOverview(FILTERS);

    expect(overview.kpis.length).toBeGreaterThan(0);
    expect(overview.funnel.length).toBeGreaterThan(0);
    expect(overview.top_tests).toEqual([
      {
        test_id: "test-focus-rhythm",
        net_revenue_eur: 700,
        purchase_conversion: 0.2,
        purchases: 18
      }
    ]);
    expect(overview.top_tenants).toEqual([
      {
        tenant_id: "tenant-quizfactory-en",
        net_revenue_eur: 760,
        purchases: 19
      }
    ]);
    expect(overview.alerts_available).toBe(true);
    expect(overview.alerts).toHaveLength(1);
    expect(overview.data_freshness).toHaveLength(3);

    const martCall = calls.find(
      (call) =>
        call.query.includes("FROM `quiz-factory-analytics.marts.mart_funnel_daily`") &&
        call.query.includes("funnel_agg")
    );
    expect(martCall).toBeDefined();
    expect(martCall?.params).toMatchObject({
      start_date: FILTERS.start,
      end_date: FILTERS.end,
      tenant_id: FILTERS.tenant_id,
      test_id: FILTERS.test_id,
      locale: FILTERS.locale,
      utm_source: FILTERS.utm_source
    });
  });

  it("caches freshness lookups for 60 seconds", async () => {
    const { provider, calls } = makeProvider(rowsForOverview);

    await provider.getOverview(FILTERS);
    const firstFreshnessCalls = calls.filter((call) => call.query.includes("CAST(MAX(date) AS STRING)")).length;
    expect(firstFreshnessCalls).toBe(3);

    await provider.getOverview(FILTERS);
    const secondFreshnessCalls = calls.filter((call) => call.query.includes("CAST(MAX(date) AS STRING)")).length;
    expect(secondFreshnessCalls).toBe(3);
  });

  it("returns alerts_available=false when the alerts table does not exist", async () => {
    const { provider } = makeProvider((query) => {
      if (query.includes("FROM `quiz-factory-analytics.marts.alert_events`")) {
        const error = new Error("Not found: Table quiz-factory-analytics:marts.alert_events");
        (error as Error & { code: number }).code = 404;
        throw error;
      }

      return rowsForOverview(query);
    });

    const overview = await provider.getOverview(FILTERS);

    expect(overview.alerts_available).toBe(false);
    expect(overview.alerts).toEqual([]);
  });
});

describe("BigQueryAdminAnalyticsProvider.getTenants", () => {
  it("returns bounded tenant rows and total count", async () => {
    const { provider, calls } = makeProvider((query) => {
      if (query.includes("ranked_top_tests")) {
        return [
          {
            tenant_id: "tenant-quizfactory-en",
            sessions: 210,
            test_starts: 150,
            test_completes: 120,
            purchases: 32,
            paid_conversion: 0.1524,
            net_revenue_eur: 1320.5,
            refunds_eur: 42.2,
            top_test_id: "test-focus-rhythm",
            last_activity_date: "2026-02-07",
            total_rows: 2
          },
          {
            tenant_id: "tenant-quizfactory-es",
            sessions: 180,
            test_starts: 132,
            test_completes: 101,
            purchases: 20,
            paid_conversion: 0.1111,
            net_revenue_eur: 980.12,
            refunds_eur: 31.9,
            top_test_id: "test-energy-balance",
            last_activity_date: "2026-02-07",
            total_rows: 2
          }
        ];
      }

      return [];
    });

    const tenants = await provider.getTenants(FILTERS);

    expect(tenants.total_rows).toBe(2);
    expect(tenants.rows).toHaveLength(2);
    expect(tenants.rows[0]).toEqual({
      tenant_id: "tenant-quizfactory-en",
      sessions: 210,
      test_starts: 150,
      test_completions: 120,
      purchases: 32,
      paid_conversion: 0.1524,
      net_revenue_eur: 1320.5,
      refunds_eur: 42.2,
      top_test_id: "test-focus-rhythm",
      last_activity_date: "2026-02-07"
    });

    const call = calls.find((candidate) => candidate.query.includes("ranked_top_tests"));
    expect(call).toBeDefined();
    expect(call?.params).toMatchObject({
      start_date: FILTERS.start,
      end_date: FILTERS.end,
      tenant_id: FILTERS.tenant_id,
      test_id: FILTERS.test_id,
      locale: FILTERS.locale,
      utm_source: FILTERS.utm_source
    });
  });
});

describe("BigQueryAdminAnalyticsProvider.getTenantDetail", () => {
  it("returns tenant detail payload with KPI, funnel, series, and breakdown tables", async () => {
    const { provider, calls } = makeProvider((query) => {
      if (query.includes("funnel_agg")) {
        return [
          {
            sessions: 90,
            test_starts: 70,
            test_completes: 55,
            paywall_views: 40,
            checkout_starts: 32,
            purchases: 18,
            paid_conversion: 0.2,
            gross_revenue_eur: 810,
            net_revenue_eur: 640,
            refunds_eur: 22,
            disputes_eur: 9,
            payment_fees_eur: 31
          }
        ];
      }

      if (query.includes("COALESCE(SUM(visits), 0) AS value")) {
        return [
          { date: "2026-02-01", value: 40 },
          { date: "2026-02-02", value: 50 }
        ];
      }

      if (query.includes("COALESCE(SUM(net_revenue_eur), 0) AS value")) {
        return [
          { date: "2026-02-01", value: 300 },
          { date: "2026-02-02", value: 340 }
        ];
      }

      if (query.includes("funnel_by_test")) {
        return [
          {
            test_id: "test-focus-rhythm",
            sessions: 55,
            test_starts: 45,
            test_completes: 36,
            purchases: 12,
            paid_conversion: 0.2182,
            net_revenue_eur: 420,
            refunds_eur: 10,
            total_rows: 2
          },
          {
            test_id: "test-energy-balance",
            sessions: 35,
            test_starts: 25,
            test_completes: 19,
            purchases: 6,
            paid_conversion: 0.1714,
            net_revenue_eur: 220,
            refunds_eur: 12,
            total_rows: 2
          }
        ];
      }

      if (query.includes("funnel_by_locale")) {
        return [
          {
            locale: "en",
            sessions: 70,
            test_starts: 54,
            test_completes: 44,
            purchases: 15,
            paid_conversion: 0.2143,
            net_revenue_eur: 480,
            refunds_eur: 15,
            total_rows: 2
          },
          {
            locale: "es",
            sessions: 20,
            test_starts: 16,
            test_completes: 11,
            purchases: 3,
            paid_conversion: 0.15,
            net_revenue_eur: 160,
            refunds_eur: 7,
            total_rows: 2
          }
        ];
      }

      return [];
    });

    const detail = await provider.getTenantDetail("tenant-quizfactory-es", FILTERS);

    expect(detail.filters.tenant_id).toBe("tenant-quizfactory-es");
    expect(detail.kpis.length).toBeGreaterThan(0);
    expect(detail.funnel.length).toBeGreaterThan(0);
    expect(detail.sessions_timeseries).toEqual([
      { date: "2026-02-01", value: 40 },
      { date: "2026-02-02", value: 50 }
    ]);
    expect(detail.revenue_timeseries).toEqual([
      { date: "2026-02-01", value: 300 },
      { date: "2026-02-02", value: 340 }
    ]);
    expect(detail.top_tests_total).toBe(2);
    expect(detail.locale_breakdown_total).toBe(2);
    expect(detail.has_data).toBe(true);

    const filterCall = calls.find((candidate) => candidate.query.includes("funnel_by_test"));
    expect(filterCall).toBeDefined();
    expect(filterCall?.params).toMatchObject({
      tenant_id: "tenant-quizfactory-es",
      start_date: FILTERS.start,
      end_date: FILTERS.end
    });
  });

  it("returns has_data=false when the tenant has no rows in range", async () => {
    const { provider } = makeProvider((query) => {
      if (query.includes("funnel_agg")) {
        return [
          {
            sessions: 0,
            test_starts: 0,
            test_completes: 0,
            paywall_views: 0,
            checkout_starts: 0,
            purchases: 0,
            paid_conversion: 0,
            gross_revenue_eur: 0,
            net_revenue_eur: 0,
            refunds_eur: 0,
            disputes_eur: 0,
            payment_fees_eur: 0
          }
        ];
      }

      return [];
    });

    const detail = await provider.getTenantDetail("tenant-missing", FILTERS);

    expect(detail.has_data).toBe(false);
    expect(detail.sessions_timeseries).toEqual([]);
    expect(detail.revenue_timeseries).toEqual([]);
    expect(detail.top_tests_total).toBe(0);
    expect(detail.locale_breakdown_total).toBe(0);
  });
});

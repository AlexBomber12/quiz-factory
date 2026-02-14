import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  resolveRows: (
    query: string,
    params: Record<string, unknown>
  ) => Array<Record<string, unknown>> | Promise<Array<Record<string, unknown>>>
): { provider: BigQueryAdminAnalyticsProvider; calls: QueryCall[] } => {
  const calls: QueryCall[] = [];
  const bigquery = {
    createQueryJob: vi.fn(async (options: { query: string; params?: Record<string, unknown> }) => {
      calls.push({
        query: options.query,
        params: options.params ?? {}
      });
      const job = {
        getQueryResults: async () =>
          [await resolveRows(options.query, options.params ?? {})] as [Array<Record<string, unknown>>]
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

  it("adds device_type filter only when explicitly enabled", () => {
    const withDeviceFilter = buildMartFilterClause(FILTERS, {
      includeDeviceTypeFilter: true
    });
    const withoutDeviceFilter = buildMartFilterClause(FILTERS);

    expect(withDeviceFilter.whereSql).toContain("device_type = @device_type");
    expect(withDeviceFilter.params).toMatchObject({
      device_type: FILTERS.device_type
    });
    expect(withoutDeviceFilter.whereSql).not.toContain("device_type = @device_type");
    expect(withoutDeviceFilter.params).not.toHaveProperty("device_type");
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

describe("BigQueryAdminAnalyticsProvider.getTests", () => {
  it("returns tests analytics list rows with tenant and activity metadata", async () => {
    const { provider, calls } = makeProvider((query) => {
      if (query.includes("ranked_tenants")) {
        return [
          {
            test_id: "test-focus-rhythm",
            sessions: 260,
            starts: 210,
            completes: 170,
            purchases: 41,
            paid_conversion: 0.1577,
            net_revenue_eur: 1840.5,
            refunds_eur: 65.4,
            top_tenant_id: "tenant-quizfactory-en",
            last_activity_date: "2026-02-07"
          },
          {
            test_id: "test-energy-balance",
            sessions: 220,
            starts: 160,
            completes: 132,
            purchases: 28,
            paid_conversion: 0.1273,
            net_revenue_eur: 1220.2,
            refunds_eur: 29.6,
            top_tenant_id: "tenant-quizfactory-es",
            last_activity_date: "2026-02-07"
          }
        ];
      }

      return [];
    });

    const tests = await provider.getTests(FILTERS);

    expect(tests.rows).toHaveLength(2);
    expect(tests.rows[0]).toEqual({
      test_id: "test-focus-rhythm",
      sessions: 260,
      starts: 210,
      completes: 170,
      purchases: 41,
      paid_conversion: 0.1577,
      net_revenue_eur: 1840.5,
      refunds_eur: 65.4,
      top_tenant_id: "tenant-quizfactory-en",
      last_activity_date: "2026-02-07"
    });

    const call = calls.find((candidate) => candidate.query.includes("ranked_tenants"));
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

describe("BigQueryAdminAnalyticsProvider.getTestDetail", () => {
  it("returns KPI/funnel, daily timeseries, tenant+locale breakdown, and paywall metrics", async () => {
    const { provider, calls } = makeProvider((query) => {
      if (query.includes("funnel_agg")) {
        return [
          {
            sessions: 170,
            test_starts: 140,
            test_completes: 112,
            paywall_views: 87,
            checkout_starts: 66,
            purchases: 31,
            paid_conversion: 0.1823,
            gross_revenue_eur: 1560,
            net_revenue_eur: 1240,
            refunds_eur: 44,
            disputes_eur: 18,
            payment_fees_eur: 58
          }
        ];
      }

      if (query.includes("WITH funnel_daily AS")) {
        return [
          {
            date: "2026-02-01",
            sessions: 80,
            completes: 52,
            purchases: 14,
            net_revenue_eur: 420
          },
          {
            date: "2026-02-02",
            sessions: 90,
            completes: 60,
            purchases: 17,
            net_revenue_eur: 520
          }
        ];
      }

      if (query.includes("funnel_by_tenant AS")) {
        return [
          {
            tenant_id: "tenant-quizfactory-en",
            sessions: 100,
            starts: 82,
            completes: 66,
            purchases: 19,
            paid_conversion: 0.19,
            net_revenue_eur: 740,
            refunds_eur: 20
          },
          {
            tenant_id: "tenant-quizfactory-es",
            sessions: 70,
            starts: 58,
            completes: 46,
            purchases: 12,
            paid_conversion: 0.1714,
            net_revenue_eur: 500,
            refunds_eur: 24
          }
        ];
      }

      if (query.includes("funnel_by_locale AS") && query.includes("LIMIT 50")) {
        return [
          {
            locale: "en",
            sessions: 120,
            starts: 96,
            completes: 77,
            purchases: 23,
            paid_conversion: 0.1917,
            net_revenue_eur: 880,
            refunds_eur: 30
          },
          {
            locale: "es",
            sessions: 50,
            starts: 44,
            completes: 35,
            purchases: 8,
            paid_conversion: 0.16,
            net_revenue_eur: 360,
            refunds_eur: 14
          }
        ];
      }

      if (query.includes("COALESCE(SUM(paywall_views), 0) AS views")) {
        return [
          {
            views: 87,
            checkout_starts: 66,
            checkout_success: 31,
            checkout_start_rate: 0.7586,
            checkout_success_rate: 0.4697
          }
        ];
      }

      return [];
    });

    const detail = await provider.getTestDetail("test-focus-rhythm", FILTERS);

    expect(detail.filters.test_id).toBe("test-focus-rhythm");
    expect(detail.kpis.length).toBeGreaterThan(0);
    expect(detail.funnel.length).toBeGreaterThan(0);
    expect(detail.timeseries).toEqual([
      {
        date: "2026-02-01",
        sessions: 80,
        completes: 52,
        purchases: 14,
        net_revenue_eur: 420
      },
      {
        date: "2026-02-02",
        sessions: 90,
        completes: 60,
        purchases: 17,
        net_revenue_eur: 520
      }
    ]);
    expect(detail.tenant_breakdown).toHaveLength(2);
    expect(detail.locale_breakdown).toHaveLength(2);
    expect(detail.paywall_metrics_available).toBe(true);
    expect(detail.paywall_metrics).toEqual({
      views: 87,
      checkout_starts: 66,
      checkout_success: 31,
      checkout_start_rate: 0.7586,
      checkout_success_rate: 0.4697
    });

    const filterCall = calls.find((candidate) => candidate.query.includes("funnel_by_tenant AS"));
    expect(filterCall).toBeDefined();
    expect(filterCall?.params).toMatchObject({
      test_id: "test-focus-rhythm",
      start_date: FILTERS.start,
      end_date: FILTERS.end
    });
  });

  it("returns paywall_metrics_available=false when paywall columns are unavailable", async () => {
    const { provider } = makeProvider((query) => {
      if (query.includes("funnel_agg")) {
        return [
          {
            sessions: 20,
            test_starts: 15,
            test_completes: 10,
            paywall_views: 7,
            checkout_starts: 5,
            purchases: 2,
            paid_conversion: 0.1,
            gross_revenue_eur: 80,
            net_revenue_eur: 60,
            refunds_eur: 3,
            disputes_eur: 1,
            payment_fees_eur: 2
          }
        ];
      }

      if (query.includes("WITH funnel_daily AS")) {
        return [
          {
            date: "2026-02-01",
            sessions: 20,
            completes: 10,
            purchases: 2,
            net_revenue_eur: 60
          }
        ];
      }

      if (query.includes("funnel_by_tenant AS") || query.includes("funnel_by_locale AS")) {
        return [];
      }

      if (query.includes("COALESCE(SUM(paywall_views), 0) AS views")) {
        const error = new Error("Not found: Table quiz-factory-analytics:marts.mart_funnel_daily");
        (error as Error & { code: number }).code = 404;
        throw error;
      }

      return [];
    });

    const detail = await provider.getTestDetail("test-focus-rhythm", FILTERS);

    expect(detail.paywall_metrics_available).toBe(false);
    expect(detail.paywall_metrics).toBeNull();
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
    expect(detail.kpis).toEqual([]);
    expect(detail.funnel).toEqual([]);
    expect(detail.sessions_timeseries).toEqual([]);
    expect(detail.revenue_timeseries).toEqual([]);
    expect(detail.top_tests_total).toBe(0);
    expect(detail.locale_breakdown_total).toBe(0);
  });
});

describe("BigQueryAdminAnalyticsProvider.getDistribution", () => {
  const originalContentDatabaseUrl = process.env.CONTENT_DATABASE_URL;

  beforeEach(() => {
    delete process.env.CONTENT_DATABASE_URL;
  });

  afterEach(() => {
    if (originalContentDatabaseUrl) {
      process.env.CONTENT_DATABASE_URL = originalContentDatabaseUrl;
      return;
    }

    delete process.env.CONTENT_DATABASE_URL;
  });

  it("returns tenant x test matrix rows and validates query bindings", async () => {
    const { provider, calls } = makeProvider((query) => {
      if (query.includes("ORDER BY net_revenue_eur_7d DESC, purchases DESC, tenant_id ASC")) {
        return [
          {
            tenant_id: "tenant-quizfactory-en",
            net_revenue_eur_7d: 1800
          },
          {
            tenant_id: "tenant-quizfactory-es",
            net_revenue_eur_7d: 900
          }
        ];
      }

      if (query.includes("ORDER BY net_revenue_eur_7d DESC, purchases DESC, test_id ASC")) {
        return [
          {
            test_id: "test-focus-rhythm",
            net_revenue_eur_7d: 1600
          },
          {
            test_id: "test-energy-balance",
            net_revenue_eur_7d: 1100
          }
        ];
      }

      if (query.includes("CROSS JOIN selected_tests")) {
        return [
          {
            tenant_id: "tenant-quizfactory-en",
            test_id: "test-focus-rhythm",
            net_revenue_eur_7d: 1000,
            paid_conversion_7d: 0.21
          },
          {
            tenant_id: "tenant-quizfactory-en",
            test_id: "test-energy-balance",
            net_revenue_eur_7d: 800,
            paid_conversion_7d: 0.16
          },
          {
            tenant_id: "tenant-quizfactory-es",
            test_id: "test-focus-rhythm",
            net_revenue_eur_7d: 600,
            paid_conversion_7d: 0.14
          },
          {
            tenant_id: "tenant-quizfactory-es",
            test_id: "test-energy-balance",
            net_revenue_eur_7d: 300,
            paid_conversion_7d: 0.1
          }
        ];
      }

      return [];
    });

    const distribution = await provider.getDistribution(FILTERS, {
      top_tenants: 2,
      top_tests: 2
    });

    expect(distribution.top_tenants).toBe(2);
    expect(distribution.top_tests).toBe(2);
    expect(distribution.row_order).toEqual([
      "tenant-quizfactory-en",
      "tenant-quizfactory-es"
    ]);
    expect(distribution.column_order).toEqual([
      "test-focus-rhythm",
      "test-energy-balance"
    ]);
    expect(distribution.rows["tenant-quizfactory-en"]?.cells["test-focus-rhythm"]).toEqual({
      tenant_id: "tenant-quizfactory-en",
      test_id: "test-focus-rhythm",
      is_published: false,
      version_id: null,
      enabled: null,
      net_revenue_eur_7d: 1000,
      paid_conversion_7d: 0.21
    });

    const topTenantCall = calls.find((call) =>
      call.query.includes("ORDER BY net_revenue_eur_7d DESC, purchases DESC, tenant_id ASC")
    );
    expect(topTenantCall).toBeDefined();
    expect(topTenantCall?.query).toContain("LIMIT 2");

    const topTestCall = calls.find((call) =>
      call.query.includes("ORDER BY net_revenue_eur_7d DESC, purchases DESC, test_id ASC")
    );
    expect(topTestCall).toBeDefined();
    expect(topTestCall?.query).toContain("LIMIT 2");

    const matrixCall = calls.find((call) => call.query.includes("CROSS JOIN selected_tests"));
    expect(matrixCall).toBeDefined();
    expect(matrixCall?.params).toMatchObject({
      start_date: FILTERS.start,
      end_date: FILTERS.end,
      tenant_id: FILTERS.tenant_id,
      test_id: FILTERS.test_id,
      locale: FILTERS.locale,
      utm_source: FILTERS.utm_source,
      tenant_ids: ["tenant-quizfactory-en", "tenant-quizfactory-es"],
      test_ids: ["test-focus-rhythm", "test-energy-balance"]
    });
  });
});

describe("BigQueryAdminAnalyticsProvider.getTraffic", () => {
  it("returns traffic breakdowns with top_n bounds and optional mart dimensions", async () => {
    const { provider, calls } = makeProvider((query, params) => {
      if (query.includes("funnel_agg")) {
        return [
          {
            sessions: 150,
            test_starts: 110,
            test_completes: 85,
            paywall_views: 60,
            checkout_starts: 42,
            purchases: 25,
            paid_conversion: 0.1667,
            gross_revenue_eur: 1250,
            net_revenue_eur: 980,
            refunds_eur: 60,
            disputes_eur: 20,
            payment_fees_eur: 70
          }
        ];
      }

      if (query.includes("traffic_channel_breakdown:utm_source")) {
        return [
          {
            segment: "meta",
            sessions: 90,
            purchases: 18,
            paid_conversion: 0.2,
            net_revenue_eur: 620
          },
          {
            segment: "google",
            sessions: 60,
            purchases: 7,
            paid_conversion: 0.1167,
            net_revenue_eur: 360
          }
        ];
      }

      if (query.includes("traffic_channel_breakdown:utm_campaign")) {
        return [
          {
            segment: "launch",
            sessions: 70,
            purchases: 13,
            paid_conversion: 0.1857,
            net_revenue_eur: 510
          },
          {
            segment: "retargeting",
            sessions: 35,
            purchases: 8,
            paid_conversion: 0.2286,
            net_revenue_eur: 300
          }
        ];
      }

      if (query.includes("traffic_column_check")) {
        if (params.column_name === "country") {
          return [{ column_count: 0 }];
        }

        return [{ column_count: 1 }];
      }

      if (query.includes("traffic_funnel_breakdown:referrer")) {
        return [
          {
            segment: "google.com",
            sessions: 58,
            purchases: 11,
            paid_conversion: 0.1897
          },
          {
            segment: "instagram.com",
            sessions: 24,
            purchases: 5,
            paid_conversion: 0.2083
          }
        ];
      }

      if (query.includes("traffic_funnel_breakdown:device_type")) {
        return [
          {
            segment: "mobile",
            sessions: 96,
            purchases: 16,
            paid_conversion: 0.1667
          },
          {
            segment: "desktop",
            sessions: 54,
            purchases: 9,
            paid_conversion: 0.1667
          }
        ];
      }

      return [];
    });

    const traffic = await provider.getTraffic(FILTERS, { top_n: 25 });

    expect(traffic.top_n).toBe(25);
    expect(traffic.kpis.length).toBeGreaterThan(0);
    expect(traffic.by_utm_source).toEqual([
      {
        segment: "meta",
        sessions: 90,
        purchases: 18,
        paid_conversion: 0.2,
        net_revenue_eur: 620
      },
      {
        segment: "google",
        sessions: 60,
        purchases: 7,
        paid_conversion: 0.1167,
        net_revenue_eur: 360
      }
    ]);
    expect(traffic.by_utm_campaign).toHaveLength(2);
    expect(traffic.by_referrer[0]).toMatchObject({
      segment: "google.com",
      sessions: 58,
      purchases: 11,
      net_revenue_eur: 0
    });
    expect(traffic.by_device_type).toHaveLength(2);
    expect(traffic.by_country).toEqual([]);

    const sourceCall = calls.find((call) => call.query.includes("traffic_channel_breakdown:utm_source"));
    expect(sourceCall).toBeDefined();
    expect(sourceCall?.query).toContain("LIMIT 25");
    expect(sourceCall?.query).toContain("device_type = @device_type");
    expect(sourceCall?.params).toMatchObject({
      start_date: FILTERS.start,
      end_date: FILTERS.end,
      tenant_id: FILTERS.tenant_id,
      test_id: FILTERS.test_id,
      locale: FILTERS.locale,
      utm_source: FILTERS.utm_source,
      device_type: FILTERS.device_type
    });

    const referrerCall = calls.find((call) => call.query.includes("traffic_funnel_breakdown:referrer"));
    expect(referrerCall).toBeDefined();
    expect(referrerCall?.query).toContain("device_type = @device_type");
    expect(referrerCall?.params).toMatchObject({
      device_type: FILTERS.device_type
    });

    expect(calls.some((call) => call.query.includes("traffic_funnel_breakdown:country"))).toBe(false);
  });
});

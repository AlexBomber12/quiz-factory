import { describe, expect, it } from "vitest";

import { evaluateFreshnessStatus } from "../data_health";
import { createMockAdminAnalyticsProvider } from "./mock";
import type { AdminAnalyticsFilters } from "../types";

const FILTERS: AdminAnalyticsFilters = {
  start: "2026-02-01",
  end: "2026-02-07",
  tenant_id: null,
  test_id: null,
  locale: "all",
  device_type: "all",
  utm_source: null
};

describe("MockAdminAnalyticsProvider", () => {
  it("returns deterministic data for the same filters", async () => {
    const provider = createMockAdminAnalyticsProvider();

    const first = await provider.getOverview(FILTERS);
    const second = await provider.getOverview(FILTERS);

    expect(first).toEqual(second);
  });

  it("returns valid response shapes for all endpoint methods", async () => {
    const provider = createMockAdminAnalyticsProvider();

    const overview = await provider.getOverview(FILTERS);
    expect(overview.filters).toEqual(FILTERS);
    expect(overview.kpis.length).toBeGreaterThan(0);
    expect(overview.funnel.length).toBeGreaterThan(0);
    expect(overview.visits_timeseries.length).toBe(7);
    expect(overview.top_tests.length).toBeGreaterThan(0);
    expect(overview.top_tenants.length).toBeGreaterThan(0);
    expect(overview.data_freshness.length).toBeGreaterThan(0);
    expect(typeof overview.alerts_available).toBe("boolean");

    const tests = await provider.getTests(FILTERS);
    expect(tests.rows.length).toBeGreaterThan(0);
    expect(tests.rows[0]).toMatchObject({
      test_id: expect.any(String),
      sessions: expect.any(Number),
      starts: expect.any(Number),
      purchases: expect.any(Number),
      top_tenant_id: expect.any(String)
    });

    const testId = tests.rows[0]?.test_id ?? "test-focus-rhythm";
    const testDetail = await provider.getTestDetail(testId, FILTERS);
    expect(testDetail.test_id).toBe(testId);
    expect(testDetail.timeseries.length).toBeGreaterThan(0);
    expect(testDetail.tenant_breakdown.length).toBeGreaterThan(0);
    expect(testDetail.locale_breakdown.length).toBeGreaterThan(0);
    expect(testDetail.paywall_metrics_available).toBe(true);
    expect(testDetail.paywall_metrics).toMatchObject({
      views: expect.any(Number),
      checkout_starts: expect.any(Number),
      checkout_success: expect.any(Number)
    });

    const tenants = await provider.getTenants(FILTERS);
    expect(tenants.rows.length).toBeGreaterThan(0);
    expect(tenants.rows[0]).toMatchObject({
      tenant_id: expect.any(String),
      sessions: expect.any(Number),
      test_starts: expect.any(Number),
      purchases: expect.any(Number),
      net_revenue_eur: expect.any(Number),
      top_test_id: expect.any(String)
    });
    expect(tenants.total_rows).toBeGreaterThan(0);

    const tenantId = tenants.rows[0]?.tenant_id ?? "tenant-quizfactory-en";
    const tenantDetail = await provider.getTenantDetail(tenantId, FILTERS);
    expect(tenantDetail.tenant_id).toBe(tenantId);
    expect(tenantDetail.funnel.length).toBeGreaterThan(0);
    expect(tenantDetail.sessions_timeseries.length).toBeGreaterThan(0);
    expect(tenantDetail.top_tests.length).toBeGreaterThan(0);
    expect(tenantDetail.top_tests_total).toBeGreaterThan(0);
    expect(tenantDetail.locale_breakdown.length).toBeGreaterThan(0);
    expect(tenantDetail.locale_breakdown_total).toBeGreaterThan(0);
    expect(tenantDetail.has_data).toBe(true);

    const distribution = await provider.getDistribution(FILTERS, {
      top_tenants: 3,
      top_tests: 2
    });
    expect(distribution.row_order.length).toBeGreaterThan(0);
    expect(distribution.column_order.length).toBeGreaterThan(0);
    const firstTenantId = distribution.row_order[0] ?? "";
    const firstTestId = distribution.column_order[0] ?? "";
    const firstRow = distribution.rows[firstTenantId];
    const firstCell = firstRow?.cells[firstTestId];
    expect(firstRow).toMatchObject({
      tenant_id: expect.any(String),
      net_revenue_eur_7d: expect.any(Number)
    });
    expect(firstCell).toMatchObject({
      tenant_id: expect.any(String),
      test_id: expect.any(String),
      is_published: expect.any(Boolean),
      net_revenue_eur_7d: expect.any(Number),
      paid_conversion_7d: expect.any(Number)
    });

    const traffic = await provider.getTraffic(FILTERS);
    expect(traffic.top_n).toBe(50);
    expect(traffic.kpis.length).toBeGreaterThan(0);
    expect(traffic.by_utm_source.length).toBeGreaterThan(0);
    expect(traffic.by_utm_campaign.length).toBeGreaterThan(0);
    expect(traffic.by_referrer.length).toBeGreaterThan(0);
    expect(traffic.by_device_type.length).toBeGreaterThan(0);
    expect(traffic.by_country.length).toBeGreaterThan(0);

    const revenue = await provider.getRevenue(FILTERS);
    expect(revenue.kpis.length).toBeGreaterThan(0);
    expect(revenue.daily.length).toBe(7);
    expect(revenue.by_offer).toHaveLength(3);
    expect(revenue.by_offer[0]).toMatchObject({
      offer_type: expect.any(String),
      offer_key: expect.any(String),
      pricing_variant: expect.any(String),
      purchases: expect.any(Number),
      gross_revenue_eur: expect.any(Number),
      refunds_eur: expect.any(Number),
      disputes_fees_eur: expect.any(Number),
      payment_fees_eur: expect.any(Number),
      net_revenue_eur: expect.any(Number)
    });
    expect(revenue.by_tenant.length).toBeGreaterThan(0);
    expect(revenue.by_test.length).toBeGreaterThan(0);
    expect(revenue.reconciliation).toMatchObject({
      available: expect.any(Boolean),
      detail: expect.any(String),
      stripe_purchase_count: expect.any(Number),
      internal_purchase_count: expect.any(Number),
      purchase_count_diff_pct: expect.any(Number),
      stripe_gross_revenue_eur: expect.any(Number),
      internal_gross_revenue_eur: expect.any(Number),
      gross_revenue_diff_pct: expect.any(Number)
    });

    const dataHealth = await provider.getDataHealth(FILTERS);
    expect(["ok", "warn", "error"]).toContain(dataHealth.status);
    expect(dataHealth.checks.length).toBeGreaterThan(0);
    expect(dataHealth.freshness.length).toBeGreaterThan(0);
    expect(typeof dataHealth.alerts_available).toBe("boolean");
    expect(dataHealth.alerts.length).toBeGreaterThan(0);
    expect(dataHealth.dbt_last_run).not.toBeNull();
    expect(dataHealth.freshness[0]).toMatchObject({
      dataset: expect.any(String),
      table: expect.any(String),
      lag_minutes: expect.any(Number),
      warn_after_minutes: expect.any(Number),
      error_after_minutes: expect.any(Number)
    });
  });

  it("evaluates freshness status using configured thresholds", async () => {
    const provider = createMockAdminAnalyticsProvider();
    const dataHealth = await provider.getDataHealth(FILTERS);

    for (const row of dataHealth.freshness) {
      expect(row.status).toBe(
        evaluateFreshnessStatus(row.lag_minutes, {
          warn_after_minutes: row.warn_after_minutes,
          error_after_minutes: row.error_after_minutes
        })
      );
    }
  });

  it("returns an empty tenant detail payload for unknown tenant_id", async () => {
    const provider = createMockAdminAnalyticsProvider();

    const detail = await provider.getTenantDetail("tenant-does-not-exist", FILTERS);

    expect(detail.tenant_id).toBe("tenant-does-not-exist");
    expect(detail.has_data).toBe(false);
    expect(detail.kpis).toEqual([]);
    expect(detail.funnel).toEqual([]);
    expect(detail.sessions_timeseries).toEqual([]);
    expect(detail.revenue_timeseries).toEqual([]);
    expect(detail.top_tests_total).toBe(0);
    expect(detail.locale_breakdown_total).toBe(0);
  });

  it("respects locale filter in test detail locale_breakdown totals", async () => {
    const provider = createMockAdminAnalyticsProvider();
    const allLocaleDetail = await provider.getTestDetail("test-focus-rhythm", FILTERS);
    const localeScopedFilters: AdminAnalyticsFilters = {
      ...FILTERS,
      locale: "es"
    };

    const detail = await provider.getTestDetail("test-focus-rhythm", localeScopedFilters);

    expect(detail.locale_breakdown).toHaveLength(1);
    expect(detail.locale_breakdown[0]?.locale).toBe("es");
    expect(allLocaleDetail.locale_breakdown.length).toBeGreaterThan(1);

    const allLocaleSessionsTotal = allLocaleDetail.locale_breakdown.reduce(
      (total, row) => total + row.sessions,
      0
    );
    const allLocalePurchasesTotal = allLocaleDetail.locale_breakdown.reduce(
      (total, row) => total + row.purchases,
      0
    );

    expect(detail.locale_breakdown[0]?.sessions).toBeLessThan(allLocaleSessionsTotal);
    expect(detail.locale_breakdown[0]?.purchases).toBeLessThanOrEqual(allLocalePurchasesTotal);
  });
});

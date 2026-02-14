import { describe, expect, it } from "vitest";

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

    const tests = await provider.getTests(FILTERS);
    expect(tests.rows.length).toBeGreaterThan(0);
    expect(tests.rows[0]).toMatchObject({
      test_id: expect.any(String),
      title: expect.any(String),
      visits: expect.any(Number)
    });

    const testId = tests.rows[0]?.test_id ?? "test-focus-rhythm";
    const testDetail = await provider.getTestDetail(testId, FILTERS);
    expect(testDetail.test_id).toBe(testId);
    expect(testDetail.locale_breakdown.length).toBeGreaterThan(0);
    expect(testDetail.device_breakdown.length).toBeGreaterThan(0);

    const tenants = await provider.getTenants(FILTERS);
    expect(tenants.rows.length).toBeGreaterThan(0);
    expect(tenants.rows[0]).toMatchObject({
      tenant_id: expect.any(String),
      domain: expect.any(String),
      visits: expect.any(Number)
    });

    const tenantId = tenants.rows[0]?.tenant_id ?? "tenant-quizfactory-en";
    const tenantDetail = await provider.getTenantDetail(tenantId, FILTERS);
    expect(tenantDetail.tenant_id).toBe(tenantId);
    expect(tenantDetail.top_tests.length).toBeGreaterThan(0);

    const distribution = await provider.getDistribution(FILTERS);
    expect(distribution.rows.length).toBeGreaterThan(0);
    expect(distribution.rows[0]).toMatchObject({
      tenant_id: expect.any(String),
      test_id: expect.any(String),
      visits: expect.any(Number)
    });

    const traffic = await provider.getTraffic(FILTERS);
    expect(traffic.kpis.length).toBeGreaterThan(0);
    expect(traffic.by_utm_source.length).toBeGreaterThan(0);
    expect(traffic.by_device_type.length).toBeGreaterThan(0);
    expect(traffic.by_locale.length).toBeGreaterThan(0);

    const revenue = await provider.getRevenue(FILTERS);
    expect(revenue.kpis.length).toBeGreaterThan(0);
    expect(revenue.daily.length).toBe(7);
    expect(revenue.by_offer).toHaveLength(3);

    const dataHealth = await provider.getDataHealth(FILTERS);
    expect(dataHealth.checks.length).toBeGreaterThan(0);
    expect(dataHealth.freshness.length).toBeGreaterThan(0);
    expect(dataHealth.freshness[0]).toMatchObject({
      dataset: expect.any(String),
      table: expect.any(String),
      lag_minutes: expect.any(Number)
    });
  });

  it("scopes cost_ingestion status to raw_costs.ad_spend_daily freshness", async () => {
    const provider = createMockAdminAnalyticsProvider();

    let sampledDataHealth: Awaited<ReturnType<typeof provider.getDataHealth>> | null = null;
    for (let dayOffset = 0; dayOffset < 120; dayOffset += 1) {
      const date = new Date(Date.UTC(2026, 1, 1 + dayOffset));
      const day = date.toISOString().slice(0, 10);
      const filters: AdminAnalyticsFilters = {
        ...FILTERS,
        start: day,
        end: day,
        utm_source: `source-${dayOffset}`
      };

      const candidate = await provider.getDataHealth(filters);
      const costRow = candidate.freshness.find(
        (row) => row.dataset === "raw_costs" && row.table === "ad_spend_daily"
      );
      const pnlRow = candidate.freshness.find(
        (row) => row.dataset === "marts" && row.table === "mart_pnl_daily"
      );
      const costCheck = candidate.checks.find((check) => check.key === "cost_ingestion");

      if (!costRow || !pnlRow || !costCheck) {
        continue;
      }

      if (pnlRow.status !== "ok" && costRow.status === "ok") {
        sampledDataHealth = candidate;
        break;
      }
    }

    expect(sampledDataHealth).not.toBeNull();
    if (!sampledDataHealth) {
      return;
    }

    const costRow = sampledDataHealth.freshness.find(
      (row) => row.dataset === "raw_costs" && row.table === "ad_spend_daily"
    );
    const costCheck = sampledDataHealth.checks.find((check) => check.key === "cost_ingestion");

    expect(costRow?.status).toBe("ok");
    expect(costCheck?.status).toBe("ok");
    expect(costCheck?.detail).toContain("raw_costs.ad_spend_daily");
  });
});

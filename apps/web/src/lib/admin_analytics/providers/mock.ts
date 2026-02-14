import { parseDateYYYYMMDD } from "../../admin/analytics_dates";
import type { AdminAnalyticsProvider } from "../provider";
import type {
  AdminAnalyticsBreakdownRow,
  AdminAnalyticsDataFreshnessRow,
  AdminAnalyticsDataHealthCheck,
  AdminAnalyticsDataResponse,
  AdminAnalyticsDistributionResponse,
  AdminAnalyticsDistributionRow,
  AdminAnalyticsFilters,
  AdminAnalyticsOverviewAlertRow,
  AdminAnalyticsOverviewFreshnessRow,
  AdminAnalyticsOverviewResponse,
  AdminAnalyticsOverviewTopTenantRow,
  AdminAnalyticsOverviewTopTestRow,
  AdminAnalyticsRevenueByOfferRow,
  AdminAnalyticsRevenueDailyRow,
  AdminAnalyticsRevenueResponse,
  AdminAnalyticsTenantDetailResponse,
  AdminAnalyticsTenantLocaleRow,
  AdminAnalyticsTenantTopTestRow,
  AdminAnalyticsTenantsResponse,
  AdminAnalyticsTestsResponse,
  AdminAnalyticsTestDetailResponse,
  AdminAnalyticsTrafficResponse,
  AdminAnalyticsTestsRow,
  AdminAnalyticsTenantsRow,
  FunnelStep,
  KpiCard,
  TimeseriesPoint
} from "../types";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const TEST_CATALOG = [
  { test_id: "test-focus-rhythm", title: "Focus Rhythm" },
  { test_id: "test-energy-balance", title: "Energy Balance" },
  { test_id: "test-stress-recovery", title: "Stress Recovery" },
  { test_id: "test-social-style", title: "Social Style" }
] as const;

const TENANT_CATALOG = [
  { tenant_id: "tenant-quizfactory-en", domain: "quizfactory.com" },
  { tenant_id: "tenant-quizfactory-es", domain: "es.quizfactory.com" },
  { tenant_id: "tenant-quizfactory-pt-br", domain: "pt.quizfactory.com" },
  { tenant_id: "tenant-quizfactory-hub", domain: "hub.quizfactory.com" }
] as const;

const DEFAULT_CHANNELS = ["direct", "google", "meta", "newsletter"] as const;
const DEFAULT_DEVICES = ["desktop", "mobile", "tablet"] as const;
const DEFAULT_LOCALES = ["en", "es", "pt-BR"] as const;
const OFFER_TYPES = ["single", "pack_5", "pack_10"] as const;
const TENANT_TABLE_LIMIT = 20;

type DailyMetrics = {
  date: string;
  visits: number;
  unique_visitors: number;
  test_starts: number;
  test_completions: number;
  purchase_success_count: number;
  gross_revenue_eur: number;
  refunds_eur: number;
  disputes_fees_eur: number;
  payment_fees_eur: number;
  net_revenue_eur: number;
};

type MetricsSummary = {
  visits: number;
  unique_visitors: number;
  test_starts: number;
  test_completions: number;
  purchase_success_count: number;
  gross_revenue_eur: number;
  refunds_eur: number;
  disputes_fees_eur: number;
  payment_fees_eur: number;
  net_revenue_eur: number;
};

const stableHash = (value: string): number => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return hash >>> 0;
};

const roundCurrency = (value: number): number => {
  return Math.round(value * 100) / 100;
};

const roundRatio = (value: number): number => {
  return Math.round(value * 10_000) / 10_000;
};

const divide = (numerator: number, denominator: number): number => {
  if (denominator <= 0) {
    return 0;
  }

  return roundRatio(numerator / denominator);
};

const sumNumbers = (values: number[]): number => {
  return values.reduce((total, value) => total + value, 0);
};

const listDatesInclusive = (start: string, end: string): string[] => {
  const startDate = parseDateYYYYMMDD(start);
  const endDate = parseDateYYYYMMDD(end);
  if (!startDate || !endDate || startDate.getTime() > endDate.getTime()) {
    return [end];
  }

  const dates: string[] = [];
  for (
    let current = startDate.getTime();
    current <= endDate.getTime();
    current += DAY_IN_MS
  ) {
    dates.push(new Date(current).toISOString().slice(0, 10));
  }

  return dates;
};

const generatedAtUtc = (filters: AdminAnalyticsFilters): string => {
  return `${filters.end}T12:00:00.000Z`;
};

const seedFromFilters = (filters: AdminAnalyticsFilters, scope: string): number => {
  return stableHash(
    [
      scope,
      filters.start,
      filters.end,
      filters.tenant_id ?? "*",
      filters.test_id ?? "*",
      filters.locale,
      filters.device_type,
      filters.utm_source ?? "*"
    ].join("|")
  );
};

const formatTitleFromId = (value: string): string => {
  const normalized = value.startsWith("test-") ? value.slice(5) : value;
  return normalized
    .split("-")
    .filter((segment) => segment.length > 0)
    .map((segment) => `${segment[0]?.toUpperCase() ?? ""}${segment.slice(1)}`)
    .join(" ");
};

const buildDailySeries = (filters: AdminAnalyticsFilters, scope: string): DailyMetrics[] => {
  const dates = listDatesInclusive(filters.start, filters.end);
  const seed = seedFromFilters(filters, scope);

  const tenantFactor = filters.tenant_id ? 0.82 : 1;
  const testFactor = filters.test_id ? 0.9 : 1;
  const localeFactor = filters.locale === "all" ? 1 : 0.9;
  const deviceFactor = filters.device_type === "all" ? 1 : 0.94;
  const channelFactor = filters.utm_source ? 0.87 : 1;
  const multiplier = tenantFactor * testFactor * localeFactor * deviceFactor * channelFactor;

  return dates.map((date, index) => {
    const base = 120 + ((seed + index * 29) % 210);
    const visits = Math.max(24, Math.round(base * multiplier));
    const uniqueVisitors = Math.min(
      visits,
      Math.max(16, Math.round(visits * (0.68 + ((seed + index) % 4) * 0.04)))
    );
    const testStarts = Math.max(8, Math.round(visits * (0.58 + ((seed + index * 3) % 7) * 0.02)));
    const testCompletions = Math.max(
      5,
      Math.min(testStarts, Math.round(testStarts * (0.6 + ((seed + index * 5) % 6) * 0.02)))
    );
    const purchases = Math.max(
      1,
      Math.min(testCompletions, Math.round(visits * (0.06 + ((seed + index * 7) % 6) * 0.004)))
    );

    const averageOrderValue = 17 + ((seed + index * 11) % 13);
    const grossRevenue = roundCurrency(purchases * averageOrderValue);
    const refunds = roundCurrency(grossRevenue * (0.018 + ((seed + index) % 3) * 0.008));
    const disputes = roundCurrency(grossRevenue * (0.004 + ((seed + index * 2) % 2) * 0.003));
    const paymentFees = roundCurrency(grossRevenue * 0.031);
    const netRevenue = roundCurrency(
      Math.max(grossRevenue - refunds - disputes - paymentFees, 0)
    );

    return {
      date,
      visits,
      unique_visitors: uniqueVisitors,
      test_starts: testStarts,
      test_completions: testCompletions,
      purchase_success_count: purchases,
      gross_revenue_eur: grossRevenue,
      refunds_eur: refunds,
      disputes_fees_eur: disputes,
      payment_fees_eur: paymentFees,
      net_revenue_eur: netRevenue
    };
  });
};

const summarizeSeries = (daily: DailyMetrics[]): MetricsSummary => {
  return {
    visits: sumNumbers(daily.map((item) => item.visits)),
    unique_visitors: sumNumbers(daily.map((item) => item.unique_visitors)),
    test_starts: sumNumbers(daily.map((item) => item.test_starts)),
    test_completions: sumNumbers(daily.map((item) => item.test_completions)),
    purchase_success_count: sumNumbers(daily.map((item) => item.purchase_success_count)),
    gross_revenue_eur: roundCurrency(sumNumbers(daily.map((item) => item.gross_revenue_eur))),
    refunds_eur: roundCurrency(sumNumbers(daily.map((item) => item.refunds_eur))),
    disputes_fees_eur: roundCurrency(sumNumbers(daily.map((item) => item.disputes_fees_eur))),
    payment_fees_eur: roundCurrency(sumNumbers(daily.map((item) => item.payment_fees_eur))),
    net_revenue_eur: roundCurrency(sumNumbers(daily.map((item) => item.net_revenue_eur)))
  };
};

const trendDelta = (
  daily: DailyMetrics[],
  selector: (value: DailyMetrics) => number
): number | null => {
  if (daily.length < 2) {
    return null;
  }

  const midpoint = Math.max(1, Math.floor(daily.length / 2));
  const firstHalf = daily.slice(0, midpoint);
  const secondHalf = daily.slice(midpoint);

  const previous = sumNumbers(firstHalf.map(selector));
  const current = sumNumbers(secondHalf.map(selector));

  if (previous <= 0) {
    return null;
  }

  return roundRatio((current - previous) / previous);
};

const buildOverviewKpis = (daily: DailyMetrics[], summary: MetricsSummary): KpiCard[] => {
  return [
    {
      key: "visits",
      label: "Visits",
      value: summary.visits,
      unit: "count",
      delta: trendDelta(daily, (row) => row.visits)
    },
    {
      key: "test_starts",
      label: "Test starts",
      value: summary.test_starts,
      unit: "count",
      delta: trendDelta(daily, (row) => row.test_starts)
    },
    {
      key: "test_completions",
      label: "Test completions",
      value: summary.test_completions,
      unit: "count",
      delta: trendDelta(daily, (row) => row.test_completions)
    },
    {
      key: "purchase_success_count",
      label: "Purchases",
      value: summary.purchase_success_count,
      unit: "count",
      delta: trendDelta(daily, (row) => row.purchase_success_count)
    },
    {
      key: "net_revenue_eur",
      label: "Net revenue (EUR)",
      value: summary.net_revenue_eur,
      unit: "currency_eur",
      delta: trendDelta(daily, (row) => row.net_revenue_eur)
    }
  ];
};

const buildFunnel = (summary: MetricsSummary): FunnelStep[] => {
  return [
    {
      key: "visits",
      label: "Visits",
      count: summary.visits,
      conversion_rate: null
    },
    {
      key: "test_start",
      label: "Test starts",
      count: summary.test_starts,
      conversion_rate: divide(summary.test_starts, summary.visits)
    },
    {
      key: "test_complete",
      label: "Test completions",
      count: summary.test_completions,
      conversion_rate: divide(summary.test_completions, summary.test_starts)
    },
    {
      key: "purchase_success",
      label: "Purchase success",
      count: summary.purchase_success_count,
      conversion_rate: divide(summary.purchase_success_count, summary.test_completions)
    }
  ];
};

const toVisitsSeries = (daily: DailyMetrics[]): TimeseriesPoint[] => {
  return daily.map((row) => ({
    date: row.date,
    value: row.visits
  }));
};

const toRevenueSeries = (daily: DailyMetrics[]): TimeseriesPoint[] => {
  return daily.map((row) => ({
    date: row.date,
    value: row.net_revenue_eur
  }));
};

const allocateByWeights = (total: number, weights: number[]): number[] => {
  if (weights.length === 0) {
    return [];
  }

  if (total <= 0) {
    return weights.map(() => 0);
  }

  const weightSum = sumNumbers(weights);
  const exact = weights.map((weight) => (total * weight) / weightSum);
  const allocated = exact.map((value) => Math.floor(value));
  let remaining = total - sumNumbers(allocated);

  const ranked = exact
    .map((value, index) => ({
      index,
      fraction: value - Math.floor(value)
    }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);

  for (let index = 0; index < remaining; index += 1) {
    allocated[ranked[index % ranked.length].index] += 1;
  }

  return allocated;
};

const buildBreakdownRows = (
  segments: string[],
  summary: MetricsSummary,
  seed: number
): AdminAnalyticsBreakdownRow[] => {
  const weights = segments.map((_, index) => ((seed + index * 19) % 11) + 3);

  const visits = allocateByWeights(summary.visits, weights);
  const uniqueVisitors = allocateByWeights(summary.unique_visitors, weights);
  const testStarts = allocateByWeights(summary.test_starts, weights);
  const testCompletions = allocateByWeights(summary.test_completions, weights);
  const purchases = allocateByWeights(summary.purchase_success_count, weights);

  return segments.map((segment, index) => ({
    segment,
    visits: visits[index],
    unique_visitors: Math.min(visits[index], uniqueVisitors[index]),
    test_starts: Math.min(visits[index], testStarts[index]),
    test_completions: Math.min(testStarts[index], testCompletions[index]),
    purchase_success_count: Math.min(testCompletions[index], purchases[index]),
    purchase_conversion: divide(purchases[index], visits[index])
  }));
};

const resolveTestIds = (filters: AdminAnalyticsFilters): string[] => {
  if (filters.test_id) {
    return [filters.test_id];
  }

  return TEST_CATALOG.map((entry) => entry.test_id);
};

const resolveTenantIds = (filters: AdminAnalyticsFilters): string[] => {
  if (filters.tenant_id) {
    return TENANT_CATALOG.some((entry) => entry.tenant_id === filters.tenant_id)
      ? [filters.tenant_id]
      : [];
  }

  return TENANT_CATALOG.map((entry) => entry.tenant_id);
};

const buildTestsRows = (filters: AdminAnalyticsFilters, scope: string): AdminAnalyticsTestsRow[] => {
  return resolveTestIds(filters)
    .map((testId) => {
      const daily = buildDailySeries({ ...filters, test_id: testId }, `${scope}:${testId}`);
      const summary = summarizeSeries(daily);
      const catalogEntry = TEST_CATALOG.find((entry) => entry.test_id === testId);

      return {
        test_id: testId,
        title: catalogEntry?.title ?? formatTitleFromId(testId),
        visits: summary.visits,
        test_starts: summary.test_starts,
        test_completions: summary.test_completions,
        purchase_success_count: summary.purchase_success_count,
        purchase_conversion: divide(summary.purchase_success_count, summary.visits),
        revenue_eur: summary.net_revenue_eur
      };
    })
    .sort((left, right) => right.revenue_eur - left.revenue_eur || left.test_id.localeCompare(right.test_id));
};

const buildTenantTopTestsRows = (
  filters: AdminAnalyticsFilters,
  tenantId: string,
  scope: string
): AdminAnalyticsTenantTopTestRow[] => {
  return resolveTestIds(filters)
    .map((testId) => {
      const daily = buildDailySeries(
        { ...filters, tenant_id: tenantId, test_id: testId },
        `${scope}:${tenantId}:${testId}`
      );
      const summary = summarizeSeries(daily);

      return {
        test_id: testId,
        sessions: summary.visits,
        test_starts: summary.test_starts,
        test_completions: summary.test_completions,
        purchases: summary.purchase_success_count,
        paid_conversion: divide(summary.purchase_success_count, summary.visits),
        net_revenue_eur: summary.net_revenue_eur,
        refunds_eur: summary.refunds_eur
      };
    })
    .sort(
      (left, right) =>
        right.net_revenue_eur - left.net_revenue_eur ||
        right.purchases - left.purchases ||
        left.test_id.localeCompare(right.test_id)
    );
};

const buildTenantLocaleBreakdownRows = (
  filters: AdminAnalyticsFilters,
  tenantId: string,
  scope: string
): AdminAnalyticsTenantLocaleRow[] => {
  const segments = filters.locale === "all" ? [...DEFAULT_LOCALES] : [filters.locale];
  const daily = buildDailySeries(
    { ...filters, tenant_id: tenantId, locale: "all" },
    `${scope}:${tenantId}`
  );
  const summary = summarizeSeries(daily);
  const seed = seedFromFilters({ ...filters, tenant_id: tenantId, locale: "all" }, `${scope}:seed`);
  const weights = segments.map((_, index) => ((seed + index * 17) % 11) + 3);

  const sessions = allocateByWeights(summary.visits, weights);
  const testStarts = allocateByWeights(summary.test_starts, weights);
  const testCompletes = allocateByWeights(summary.test_completions, weights);
  const purchases = allocateByWeights(summary.purchase_success_count, weights);
  const netRevenue = allocateByWeights(Math.round(summary.net_revenue_eur * 100), weights).map(
    (cents) => roundCurrency(cents / 100)
  );
  const refunds = allocateByWeights(Math.round(summary.refunds_eur * 100), weights).map(
    (cents) => roundCurrency(cents / 100)
  );

  return segments
    .map((locale, index) => {
      const safeStarts = Math.min(sessions[index], testStarts[index]);
      const safeCompletes = Math.min(safeStarts, testCompletes[index]);
      const safePurchases = Math.min(safeCompletes, purchases[index]);

      return {
        locale,
        sessions: sessions[index],
        test_starts: safeStarts,
        test_completions: safeCompletes,
        purchases: safePurchases,
        paid_conversion: divide(safePurchases, sessions[index]),
        net_revenue_eur: netRevenue[index],
        refunds_eur: refunds[index]
      };
    })
    .sort(
      (left, right) =>
        right.net_revenue_eur - left.net_revenue_eur ||
        right.purchases - left.purchases ||
        left.locale.localeCompare(right.locale)
    );
};

const buildTenantsRows = (
  filters: AdminAnalyticsFilters,
  scope: string
): AdminAnalyticsTenantsRow[] => {
  return resolveTenantIds(filters)
    .map((tenantId) => {
      const daily = buildDailySeries(
        { ...filters, tenant_id: tenantId },
        `${scope}:${tenantId}`
      );
      const summary = summarizeSeries(daily);
      const topTests = buildTenantTopTestsRows(filters, tenantId, `${scope}:top-tests`);

      return {
        tenant_id: tenantId,
        sessions: summary.visits,
        test_starts: summary.test_starts,
        test_completions: summary.test_completions,
        purchases: summary.purchase_success_count,
        paid_conversion: divide(summary.purchase_success_count, summary.visits),
        net_revenue_eur: summary.net_revenue_eur,
        refunds_eur: summary.refunds_eur,
        top_test_id: topTests[0]?.test_id ?? null,
        last_activity_date: daily[daily.length - 1]?.date ?? null
      };
    })
    .sort(
      (left, right) =>
        right.net_revenue_eur - left.net_revenue_eur ||
        right.purchases - left.purchases ||
        left.tenant_id.localeCompare(right.tenant_id)
    );
};

const buildOverviewTopTests = (filters: AdminAnalyticsFilters): AdminAnalyticsOverviewTopTestRow[] => {
  return buildTestsRows(filters, "overview-top-tests")
    .slice(0, 5)
    .map((row) => ({
      test_id: row.test_id,
      net_revenue_eur: row.revenue_eur,
      purchase_conversion: row.purchase_conversion,
      purchases: row.purchase_success_count
    }));
};

const buildOverviewTopTenants = (filters: AdminAnalyticsFilters): AdminAnalyticsOverviewTopTenantRow[] => {
  return buildTenantsRows(filters, "overview-top-tenants")
    .slice(0, 5)
    .map((row) => ({
      tenant_id: row.tenant_id,
      net_revenue_eur: row.net_revenue_eur,
      purchases: row.purchases
    }));
};

const buildOverviewFreshness = (filters: AdminAnalyticsFilters): AdminAnalyticsOverviewFreshnessRow[] => {
  const endDate = parseDateYYYYMMDD(filters.end);
  const fallbackDate = "2026-01-01";
  const anchor = endDate ? new Date(endDate.getTime()) : parseDateYYYYMMDD(fallbackDate) ?? new Date();

  return [
    {
      table: "mart_funnel_daily",
      max_date: new Date(anchor.getTime() - DAY_IN_MS).toISOString().slice(0, 10),
      available: true
    },
    {
      table: "mart_pnl_daily",
      max_date: new Date(anchor.getTime() - DAY_IN_MS).toISOString().slice(0, 10),
      available: true
    },
    {
      table: "mart_unit_econ_daily",
      max_date: new Date(anchor.getTime() - 2 * DAY_IN_MS).toISOString().slice(0, 10),
      available: true
    }
  ];
};

const buildOverviewAlerts = (filters: AdminAnalyticsFilters): AdminAnalyticsOverviewAlertRow[] => {
  const seed = seedFromFilters(filters, "overview-alerts");
  const endDate = parseDateYYYYMMDD(filters.end);
  const detectedAt = endDate
    ? new Date(endDate.getTime() + 14 * 60 * 60 * 1000)
    : new Date(Date.UTC(2026, 1, 1, 14, 0, 0));

  return [
    {
      detected_at_utc: detectedAt.toISOString(),
      alert_name: "conversion_drop",
      severity: "warn",
      tenant_id: filters.tenant_id ?? "tenant-quizfactory-en",
      metric_value: roundRatio(0.12 + (seed % 5) * 0.01),
      threshold_value: 0.15
    }
  ];
};

export class MockAdminAnalyticsProvider implements AdminAnalyticsProvider {
  async getOverview(filters: AdminAnalyticsFilters): Promise<AdminAnalyticsOverviewResponse> {
    const daily = buildDailySeries(filters, "overview");
    const summary = summarizeSeries(daily);

    return {
      filters,
      generated_at_utc: generatedAtUtc(filters),
      kpis: buildOverviewKpis(daily, summary),
      funnel: buildFunnel(summary),
      visits_timeseries: toVisitsSeries(daily),
      revenue_timeseries: toRevenueSeries(daily),
      top_tests: buildOverviewTopTests(filters),
      top_tenants: buildOverviewTopTenants(filters),
      data_freshness: buildOverviewFreshness(filters),
      alerts_available: true,
      alerts: buildOverviewAlerts(filters)
    };
  }

  async getTests(filters: AdminAnalyticsFilters): Promise<AdminAnalyticsTestsResponse> {
    return {
      filters,
      generated_at_utc: generatedAtUtc(filters),
      rows: buildTestsRows(filters, "tests")
    };
  }

  async getTestDetail(
    testId: string,
    filters: AdminAnalyticsFilters
  ): Promise<AdminAnalyticsTestDetailResponse> {
    const scopedFilters: AdminAnalyticsFilters = {
      ...filters,
      test_id: testId
    };
    const daily = buildDailySeries(scopedFilters, `tests-detail:${testId}`);
    const summary = summarizeSeries(daily);

    const localeSegments = scopedFilters.locale === "all"
      ? [...DEFAULT_LOCALES]
      : [scopedFilters.locale];
    const deviceSegments = scopedFilters.device_type === "all"
      ? [...DEFAULT_DEVICES]
      : [scopedFilters.device_type];

    return {
      filters: scopedFilters,
      generated_at_utc: generatedAtUtc(scopedFilters),
      test_id: testId,
      kpis: buildOverviewKpis(daily, summary),
      funnel: buildFunnel(summary),
      visits_timeseries: toVisitsSeries(daily),
      revenue_timeseries: toRevenueSeries(daily),
      locale_breakdown: buildBreakdownRows(
        localeSegments,
        summary,
        seedFromFilters(scopedFilters, "test-locale-breakdown")
      ),
      device_breakdown: buildBreakdownRows(
        deviceSegments,
        summary,
        seedFromFilters(scopedFilters, "test-device-breakdown")
      )
    };
  }

  async getTenants(filters: AdminAnalyticsFilters): Promise<AdminAnalyticsTenantsResponse> {
    const rows = buildTenantsRows(filters, "tenants");

    return {
      filters,
      generated_at_utc: generatedAtUtc(filters),
      rows: rows.slice(0, TENANT_TABLE_LIMIT),
      total_rows: rows.length
    };
  }

  async getTenantDetail(
    tenantId: string,
    filters: AdminAnalyticsFilters
  ): Promise<AdminAnalyticsTenantDetailResponse> {
    const scopedFilters: AdminAnalyticsFilters = {
      ...filters,
      tenant_id: tenantId
    };

    const isKnownTenant = TENANT_CATALOG.some((entry) => entry.tenant_id === tenantId);
    if (!isKnownTenant) {
      return {
        filters: scopedFilters,
        generated_at_utc: generatedAtUtc(scopedFilters),
        tenant_id: tenantId,
        kpis: [],
        funnel: [],
        sessions_timeseries: [],
        revenue_timeseries: [],
        top_tests: [],
        top_tests_total: 0,
        locale_breakdown: [],
        locale_breakdown_total: 0,
        has_data: false
      };
    }

    const daily = buildDailySeries(scopedFilters, `tenants-detail:${tenantId}`);
    const summary = summarizeSeries(daily);
    const topTests = buildTenantTopTestsRows(scopedFilters, tenantId, "tenant-top-tests");
    const localeBreakdown = buildTenantLocaleBreakdownRows(scopedFilters, tenantId, "tenant-locale-breakdown");

    return {
      filters: scopedFilters,
      generated_at_utc: generatedAtUtc(scopedFilters),
      tenant_id: tenantId,
      kpis: buildOverviewKpis(daily, summary),
      funnel: buildFunnel(summary),
      sessions_timeseries: toVisitsSeries(daily),
      revenue_timeseries: toRevenueSeries(daily),
      top_tests: topTests.slice(0, TENANT_TABLE_LIMIT),
      top_tests_total: topTests.length,
      locale_breakdown: localeBreakdown.slice(0, TENANT_TABLE_LIMIT),
      locale_breakdown_total: localeBreakdown.length,
      has_data: true
    };
  }

  async getDistribution(filters: AdminAnalyticsFilters): Promise<AdminAnalyticsDistributionResponse> {
    const tenantIds = resolveTenantIds(filters).slice(0, 3);
    const testIds = resolveTestIds(filters).slice(0, 3);
    const rows: AdminAnalyticsDistributionRow[] = [];

    for (const tenantId of tenantIds) {
      for (const testId of testIds) {
        const scopedFilters: AdminAnalyticsFilters = {
          ...filters,
          tenant_id: tenantId,
          test_id: testId
        };
        const daily = buildDailySeries(scopedFilters, `distribution:${tenantId}:${testId}`);
        const summary = summarizeSeries(daily);

        rows.push({
          tenant_id: tenantId,
          test_id: testId,
          visits: summary.visits,
          test_completions: summary.test_completions,
          purchase_success_count: summary.purchase_success_count,
          revenue_eur: summary.net_revenue_eur
        });
      }
    }

    rows.sort(
      (left, right) =>
        right.revenue_eur - left.revenue_eur ||
        left.tenant_id.localeCompare(right.tenant_id) ||
        left.test_id.localeCompare(right.test_id)
    );

    return {
      filters,
      generated_at_utc: generatedAtUtc(filters),
      rows
    };
  }

  async getTraffic(filters: AdminAnalyticsFilters): Promise<AdminAnalyticsTrafficResponse> {
    const daily = buildDailySeries(filters, "traffic");
    const summary = summarizeSeries(daily);
    const channelSegments = filters.utm_source ? [filters.utm_source] : [...DEFAULT_CHANNELS];
    const deviceSegments = filters.device_type === "all"
      ? [...DEFAULT_DEVICES]
      : [filters.device_type];
    const localeSegments = filters.locale === "all"
      ? [...DEFAULT_LOCALES]
      : [filters.locale];

    return {
      filters,
      generated_at_utc: generatedAtUtc(filters),
      kpis: [
        {
          key: "visits",
          label: "Visits",
          value: summary.visits,
          unit: "count",
          delta: trendDelta(daily, (row) => row.visits)
        },
        {
          key: "unique_visitors",
          label: "Unique visitors",
          value: summary.unique_visitors,
          unit: "count",
          delta: trendDelta(daily, (row) => row.unique_visitors)
        },
        {
          key: "test_starts",
          label: "Test starts",
          value: summary.test_starts,
          unit: "count",
          delta: trendDelta(daily, (row) => row.test_starts)
        },
        {
          key: "test_completions",
          label: "Test completions",
          value: summary.test_completions,
          unit: "count",
          delta: trendDelta(daily, (row) => row.test_completions)
        },
        {
          key: "purchase_conversion",
          label: "Purchase conversion",
          value: divide(summary.purchase_success_count, summary.visits),
          unit: "ratio",
          delta: trendDelta(daily, (row) => divide(row.purchase_success_count, row.visits))
        }
      ],
      by_utm_source: buildBreakdownRows(
        channelSegments,
        summary,
        seedFromFilters(filters, "traffic-by-channel")
      ),
      by_device_type: buildBreakdownRows(
        deviceSegments,
        summary,
        seedFromFilters(filters, "traffic-by-device")
      ),
      by_locale: buildBreakdownRows(
        localeSegments,
        summary,
        seedFromFilters(filters, "traffic-by-locale")
      )
    };
  }

  async getRevenue(filters: AdminAnalyticsFilters): Promise<AdminAnalyticsRevenueResponse> {
    const daily = buildDailySeries(filters, "revenue");
    const summary = summarizeSeries(daily);
    const offerWeights = OFFER_TYPES.map((_, index) => ((seedFromFilters(filters, "offers") + index * 17) % 10) + 2);

    const purchasesByOffer = allocateByWeights(summary.purchase_success_count, offerWeights);
    const grossByOffer = allocateByWeights(Math.round(summary.gross_revenue_eur * 100), offerWeights).map(
      (value) => roundCurrency(value / 100)
    );
    const netByOffer = allocateByWeights(Math.round(summary.net_revenue_eur * 100), offerWeights).map(
      (value) => roundCurrency(value / 100)
    );

    const byOffer: AdminAnalyticsRevenueByOfferRow[] = OFFER_TYPES.map((offerType, index) => ({
      offer_type: offerType,
      purchases: purchasesByOffer[index],
      gross_revenue_eur: grossByOffer[index],
      net_revenue_eur: netByOffer[index]
    }));

    const dailyRows: AdminAnalyticsRevenueDailyRow[] = daily.map((row) => ({
      date: row.date,
      gross_revenue_eur: row.gross_revenue_eur,
      refunds_eur: row.refunds_eur,
      disputes_fees_eur: row.disputes_fees_eur,
      payment_fees_eur: row.payment_fees_eur,
      net_revenue_eur: row.net_revenue_eur
    }));

    return {
      filters,
      generated_at_utc: generatedAtUtc(filters),
      kpis: [
        {
          key: "gross_revenue_eur",
          label: "Gross revenue (EUR)",
          value: summary.gross_revenue_eur,
          unit: "currency_eur",
          delta: trendDelta(daily, (row) => row.gross_revenue_eur)
        },
        {
          key: "refunds_eur",
          label: "Refunds (EUR)",
          value: summary.refunds_eur,
          unit: "currency_eur",
          delta: trendDelta(daily, (row) => row.refunds_eur)
        },
        {
          key: "disputes_fees_eur",
          label: "Disputes fees (EUR)",
          value: summary.disputes_fees_eur,
          unit: "currency_eur",
          delta: trendDelta(daily, (row) => row.disputes_fees_eur)
        },
        {
          key: "payment_fees_eur",
          label: "Payment fees (EUR)",
          value: summary.payment_fees_eur,
          unit: "currency_eur",
          delta: trendDelta(daily, (row) => row.payment_fees_eur)
        },
        {
          key: "net_revenue_eur",
          label: "Net revenue (EUR)",
          value: summary.net_revenue_eur,
          unit: "currency_eur",
          delta: trendDelta(daily, (row) => row.net_revenue_eur)
        }
      ],
      daily: dailyRows,
      by_offer: byOffer
    };
  }

  async getDataHealth(filters: AdminAnalyticsFilters): Promise<AdminAnalyticsDataResponse> {
    const seed = seedFromFilters(filters, "data-health");
    const endDate = parseDateYYYYMMDD(filters.end);
    const anchor = endDate
      ? new Date(endDate.getTime() + 15 * 60 * 60 * 1000)
      : new Date(Date.UTC(2026, 0, 1, 15, 0, 0));

    const freshnessRows: AdminAnalyticsDataFreshnessRow[] = [
      {
        dataset: "marts",
        table: "mart_funnel_daily",
        last_loaded_utc: new Date(anchor.getTime() - ((seed % 45) + 10) * 60_000).toISOString(),
        lag_minutes: (seed % 45) + 10,
        status: "ok"
      },
      {
        dataset: "marts",
        table: "mart_pnl_daily",
        last_loaded_utc: new Date(anchor.getTime() - ((seed % 80) + 35) * 60_000).toISOString(),
        lag_minutes: (seed % 80) + 35,
        status: (seed % 80) + 35 > 90 ? "warn" : "ok"
      },
      {
        dataset: "raw_stripe",
        table: "purchases",
        last_loaded_utc: new Date(anchor.getTime() - ((seed % 25) + 5) * 60_000).toISOString(),
        lag_minutes: (seed % 25) + 5,
        status: "ok"
      },
      {
        dataset: "raw_costs",
        table: "ad_spend_daily",
        last_loaded_utc: new Date(anchor.getTime() - ((seed % 180) + 50) * 60_000).toISOString(),
        lag_minutes: (seed % 180) + 50,
        status: (seed % 180) + 50 > 180 ? "warn" : "ok"
      }
    ];

    const costFreshnessRow =
      freshnessRows.find(
        (row) => row.dataset === "raw_costs" && row.table === "ad_spend_daily"
      ) ?? freshnessRows[3];

    const checks: AdminAnalyticsDataHealthCheck[] = [
      {
        key: "funnel_freshness",
        label: "Funnel mart freshness",
        status: freshnessRows[0].status,
        detail: freshnessRows[0].status === "ok"
          ? "mart_funnel_daily is fresh."
          : "mart_funnel_daily lag is above expected threshold.",
        last_updated_utc: freshnessRows[0].last_loaded_utc
      },
      {
        key: "pnl_freshness",
        label: "P&L mart freshness",
        status: freshnessRows[1].status,
        detail: freshnessRows[1].status === "ok"
          ? "mart_pnl_daily is fresh."
          : "mart_pnl_daily lag exceeded warning threshold.",
        last_updated_utc: freshnessRows[1].last_loaded_utc
      },
      {
        key: "stripe_ingestion",
        label: "Stripe ingestion",
        status: freshnessRows[2].status,
        detail: "Stripe purchase facts are ingesting on schedule.",
        last_updated_utc: freshnessRows[2].last_loaded_utc
      },
      {
        key: "cost_ingestion",
        label: "Ad spend ingestion",
        status: costFreshnessRow.status,
        detail: costFreshnessRow.status === "ok"
          ? "raw_costs.ad_spend_daily is fresh."
          : "raw_costs.ad_spend_daily lag exceeded warning threshold.",
        last_updated_utc: costFreshnessRow.last_loaded_utc
      }
    ];

    return {
      filters,
      generated_at_utc: generatedAtUtc(filters),
      checks,
      freshness: freshnessRows
    };
  }
}

export const createMockAdminAnalyticsProvider = (): AdminAnalyticsProvider => {
  return new MockAdminAnalyticsProvider();
};

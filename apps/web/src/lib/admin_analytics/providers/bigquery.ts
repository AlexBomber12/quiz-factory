import { BigQuery } from "@google-cloud/bigquery";

import {
  AdminAnalyticsNotImplementedError,
  type AdminAnalyticsProvider
} from "../provider";
import { getContentDbPool, hasContentDatabaseUrl } from "../../content_db/pool";
import {
  resolveAdminAnalyticsDistributionOptions,
  type AdminAnalyticsDataResponse,
  type AdminAnalyticsDistributionCell,
  type AdminAnalyticsDistributionColumn,
  type AdminAnalyticsDistributionOptions,
  type AdminAnalyticsDistributionResponse,
  type AdminAnalyticsFilters,
  type AdminAnalyticsOverviewAlertRow,
  type AdminAnalyticsOverviewFreshnessRow,
  type AdminAnalyticsOverviewResponse,
  type AdminAnalyticsRevenueResponse,
  type AdminAnalyticsTenantDetailResponse,
  type AdminAnalyticsTenantLocaleRow,
  type AdminAnalyticsTenantTopTestRow,
  type AdminAnalyticsTenantsRow,
  type AdminAnalyticsTenantsResponse,
  type AdminAnalyticsTestLocaleRow,
  type AdminAnalyticsTestDetailResponse,
  type AdminAnalyticsTestPaywallMetrics,
  type AdminAnalyticsTestTenantRow,
  type AdminAnalyticsTestTimeseriesRow,
  type AdminAnalyticsTestsResponse,
  type AdminAnalyticsTrafficOptions,
  type AdminAnalyticsTrafficSegmentRow,
  type AdminAnalyticsTrafficResponse,
  type FunnelStep,
  type KpiCard,
  type TimeseriesPoint,
  resolveAdminAnalyticsTrafficOptions
} from "../types";

const DEFAULT_MARTS_DATASET = "marts";
const OVERVIEW_TOP_ROWS_LIMIT = 10;
const TENANTS_TOP_ROWS_LIMIT = 20;
const TESTS_TOP_ROWS_LIMIT = 50;
const TEST_BREAKDOWN_ROWS_LIMIT = 50;
const ALERTS_LIMIT = 20;
const FRESHNESS_CACHE_TTL_MS = 60_000;

type BigQueryAdminAnalyticsDatasets = {
  stripe: string;
  rawCosts: string;
  tmp: string;
  marts: string;
};

type BigQueryRow = Record<string, unknown>;

type BigQueryQueryJobLike = {
  getQueryResults(): Promise<[BigQueryRow[], ...unknown[]]>;
};

type BigQueryQueryOptions = {
  query: string;
  params?: Record<string, unknown>;
  useLegacySql?: boolean;
};

export type BigQueryClientLike = {
  createQueryJob(options: BigQueryQueryOptions): Promise<[BigQueryQueryJobLike, ...unknown[]]>;
};

type BigQueryQuery = {
  query: string;
  params: Record<string, unknown>;
};

type OverviewAggregateRow = {
  sessions: number;
  test_starts: number;
  test_completes: number;
  paywall_views: number;
  checkout_starts: number;
  purchases: number;
  paid_conversion: number;
  gross_revenue_eur: number;
  net_revenue_eur: number;
  refunds_eur: number;
  disputes_eur: number;
  payment_fees_eur: number;
};

type OverviewAlertResult = {
  available: boolean;
  rows: AdminAnalyticsOverviewAlertRow[];
};

type FreshnessCacheEntry = {
  expiresAt: number;
  rows: AdminAnalyticsOverviewFreshnessRow[];
};

type DistributionTopTenantRow = {
  tenant_id: string;
  net_revenue_eur_7d: number;
};

type DistributionTopTestRow = {
  test_id: string;
  net_revenue_eur_7d: number;
};

type DistributionMetricRow = {
  tenant_id: string;
  test_id: string;
  net_revenue_eur_7d: number;
  paid_conversion_7d: number;
};

type DistributionPublicationState = {
  is_published: boolean;
  version_id: string | null;
  enabled: boolean | null;
};

type DistributionPublicationRow = {
  tenant_id: string | null;
  test_id: string | null;
  is_enabled: boolean | null;
  version_id: string | null;
};

type TrafficChannelBreakdown = "utm_source" | "utm_campaign";

type TrafficFunnelDimension = "referrer" | "device_type" | "country";

const freshnessCache = new Map<string, FreshnessCacheEntry>();

const asNumber = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (value && typeof value === "object" && "value" in value) {
    return asNumber((value as { value: unknown }).value);
  }

  return 0;
};

const asNullableString = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value && typeof value === "object" && "value" in value) {
    return asNullableString((value as { value: unknown }).value);
  }

  return String(value);
};

const asNonEmptyString = (value: unknown): string | null => {
  const normalized = asNullableString(value);
  if (!normalized) {
    return null;
  }

  const trimmed = normalized.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asIsoTimestamp = (value: unknown): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  const raw = asNullableString(value);
  if (!raw) {
    return "";
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }

  return parsed.toISOString();
};

const safeRatio = (numerator: number, denominator: number): number => {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }

  return Math.round((numerator / denominator) * 10_000) / 10_000;
};

const isNotFoundError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; message?: unknown };
  const code = candidate.code;
  if (typeof code === "number" && code === 404) {
    return true;
  }

  const message = typeof candidate.message === "string" ? candidate.message.toLowerCase() : "";
  return message.includes("not found");
};

const distributionCellKey = (tenantId: string, testId: string): string => {
  return `${tenantId}::${testId}`;
};

const mergeParams = (...parts: Array<Record<string, unknown>>): Record<string, unknown> => {
  const merged: Record<string, unknown> = {};
  for (const part of parts) {
    Object.assign(merged, part);
  }

  return merged;
};

type MartFilterClause = {
  whereSql: string;
  params: Record<string, unknown>;
};

type MartFilterClauseOptions = {
  dateColumn?: string;
  tenantColumn?: string;
  testColumn?: string;
  localeColumn?: string;
  deviceColumn?: string;
  channelColumn?: string;
  includeTestFilter?: boolean;
  includeLocaleFilter?: boolean;
  includeDeviceTypeFilter?: boolean;
  includeUtmSourceFilter?: boolean;
};

export const buildMartFilterClause = (
  filters: AdminAnalyticsFilters,
  options: MartFilterClauseOptions = {}
): MartFilterClause => {
  const dateColumn = options.dateColumn ?? "date";
  const tenantColumn = options.tenantColumn ?? "tenant_id";
  const testColumn = options.testColumn ?? "test_id";
  const localeColumn = options.localeColumn ?? "locale";
  const deviceColumn = options.deviceColumn ?? "device_type";
  const channelColumn = options.channelColumn ?? "channel_key";
  const includeTestFilter = options.includeTestFilter ?? true;
  const includeLocaleFilter = options.includeLocaleFilter ?? true;
  const includeDeviceTypeFilter = options.includeDeviceTypeFilter ?? false;
  const includeUtmSourceFilter = options.includeUtmSourceFilter ?? true;

  const conditions: string[] = [
    `${dateColumn} BETWEEN DATE(@start_date) AND DATE(@end_date)`
  ];
  const params: Record<string, unknown> = {
    start_date: filters.start,
    end_date: filters.end
  };

  if (filters.tenant_id) {
    conditions.push(`${tenantColumn} = @tenant_id`);
    params.tenant_id = filters.tenant_id;
  }

  if (includeTestFilter && filters.test_id) {
    conditions.push(`${testColumn} = @test_id`);
    params.test_id = filters.test_id;
  }

  if (includeLocaleFilter && filters.locale !== "all") {
    conditions.push(`${localeColumn} = @locale`);
    params.locale = filters.locale;
  }

  if (includeDeviceTypeFilter && filters.device_type !== "all") {
    conditions.push(`${deviceColumn} = @device_type`);
    params.device_type = filters.device_type;
  }

  if (includeUtmSourceFilter && filters.utm_source) {
    conditions.push(
      `(CASE WHEN STRPOS(${channelColumn}, ':') > 0 THEN SPLIT(${channelColumn}, ':')[SAFE_OFFSET(0)] ELSE ${channelColumn} END) = @utm_source`
    );
    params.utm_source = filters.utm_source;
  }

  return {
    whereSql: `WHERE ${conditions.join(" AND ")}`,
    params
  };
};

const buildTrafficChannelSegmentExpression = (breakdown: TrafficChannelBreakdown): string => {
  if (breakdown === "utm_campaign") {
    return `
      CASE
        WHEN channel_key IN ('direct', 'organic', 'referral') THEN NULL
        WHEN STRPOS(channel_key, ':') > 0 THEN SPLIT(channel_key, ':')[SAFE_OFFSET(1)]
        ELSE NULL
      END
    `.trim();
  }

  return `
    CASE
      WHEN channel_key IN ('direct', 'organic', 'referral') THEN channel_key
      WHEN STRPOS(channel_key, ':') > 0 THEN SPLIT(channel_key, ':')[SAFE_OFFSET(0)]
      ELSE channel_key
    END
  `.trim();
};

const buildTrafficChannelBreakdownQuery = (
  projectId: string,
  datasets: BigQueryAdminAnalyticsDatasets,
  filters: AdminAnalyticsFilters,
  breakdown: TrafficChannelBreakdown,
  topN: number,
  options: {
    includeFunnelDeviceTypeFilter?: boolean;
    includePnlDeviceTypeFilter?: boolean;
  } = {}
): BigQueryQuery => {
  const funnelFilter = buildMartFilterClause(filters, {
    includeDeviceTypeFilter: options.includeFunnelDeviceTypeFilter ?? false
  });
  const pnlFilter = buildMartFilterClause(filters, {
    includeDeviceTypeFilter: options.includePnlDeviceTypeFilter ?? false
  });
  const funnelTable = `\`${projectId}.${datasets.marts}.mart_funnel_daily\``;
  const pnlTable = `\`${projectId}.${datasets.marts}.mart_pnl_daily\``;
  const segmentExpression = buildTrafficChannelSegmentExpression(breakdown);
  const removeUnknownCampaignClause = breakdown === "utm_campaign"
    ? "AND segment != 'unknown'"
    : "";

  return {
    query: `
      /* traffic_channel_breakdown:${breakdown} */
      WITH funnel_by_segment AS (
        SELECT
          ${segmentExpression} AS segment,
          COALESCE(SUM(visits), 0) AS sessions,
          COALESCE(SUM(purchases), 0) AS purchases
        FROM ${funnelTable}
        ${funnelFilter.whereSql}
        GROUP BY segment
      ),
      pnl_by_segment AS (
        SELECT
          ${segmentExpression} AS segment,
          COALESCE(SUM(net_revenue_eur), 0) AS net_revenue_eur
        FROM ${pnlTable}
        ${pnlFilter.whereSql}
        GROUP BY segment
      ),
      merged AS (
        SELECT
          COALESCE(funnel_by_segment.segment, pnl_by_segment.segment) AS segment,
          COALESCE(funnel_by_segment.sessions, 0) AS sessions,
          COALESCE(funnel_by_segment.purchases, 0) AS purchases,
          SAFE_DIVIDE(
            COALESCE(funnel_by_segment.purchases, 0),
            NULLIF(COALESCE(funnel_by_segment.sessions, 0), 0)
          ) AS paid_conversion,
          COALESCE(pnl_by_segment.net_revenue_eur, 0) AS net_revenue_eur
        FROM funnel_by_segment
        FULL OUTER JOIN pnl_by_segment
          ON funnel_by_segment.segment = pnl_by_segment.segment
      )
      SELECT
        segment,
        sessions,
        purchases,
        paid_conversion,
        net_revenue_eur
      FROM merged
      WHERE segment IS NOT NULL
        AND segment != '__unallocated__'
        ${removeUnknownCampaignClause}
      ORDER BY sessions DESC, purchases DESC, segment ASC
      LIMIT ${topN}
    `,
    params: mergeParams(funnelFilter.params, pnlFilter.params)
  };
};

const buildTrafficFunnelDimensionBreakdownQuery = (
  projectId: string,
  datasets: BigQueryAdminAnalyticsDatasets,
  filters: AdminAnalyticsFilters,
  dimension: TrafficFunnelDimension,
  topN: number,
  options: {
    includeDeviceTypeFilter?: boolean;
  } = {}
): BigQueryQuery => {
  const funnelFilter = buildMartFilterClause(filters, {
    includeDeviceTypeFilter: options.includeDeviceTypeFilter ?? false
  });
  const funnelTable = `\`${projectId}.${datasets.marts}.mart_funnel_daily\``;

  return {
    query: `
      /* traffic_funnel_breakdown:${dimension} */
      SELECT
        COALESCE(NULLIF(TRIM(CAST(${dimension} AS STRING)), ''), 'unknown') AS segment,
        COALESCE(SUM(visits), 0) AS sessions,
        COALESCE(SUM(purchases), 0) AS purchases,
        SAFE_DIVIDE(
          COALESCE(SUM(purchases), 0),
          NULLIF(COALESCE(SUM(visits), 0), 0)
        ) AS paid_conversion
      FROM ${funnelTable}
      ${funnelFilter.whereSql}
      GROUP BY segment
      HAVING segment != '__unallocated__'
      ORDER BY sessions DESC, purchases DESC, segment ASC
      LIMIT ${topN}
    `,
    params: funnelFilter.params
  };
};

const buildOverviewAggregateQuery = (
  projectId: string,
  datasets: BigQueryAdminAnalyticsDatasets,
  filters: AdminAnalyticsFilters
): BigQueryQuery => {
  const funnelFilter = buildMartFilterClause(filters);
  const pnlFilter = buildMartFilterClause(filters);
  const funnelTable = `\`${projectId}.${datasets.marts}.mart_funnel_daily\``;
  const pnlTable = `\`${projectId}.${datasets.marts}.mart_pnl_daily\``;

  return {
    query: `
      WITH funnel_agg AS (
        SELECT
          COALESCE(SUM(visits), 0) AS sessions,
          COALESCE(SUM(test_starts), 0) AS test_starts,
          COALESCE(SUM(test_completes), 0) AS test_completes,
          COALESCE(SUM(paywall_views), 0) AS paywall_views,
          COALESCE(SUM(checkout_starts), 0) AS checkout_starts,
          COALESCE(SUM(purchases), 0) AS purchases
        FROM ${funnelTable}
        ${funnelFilter.whereSql}
      ),
      pnl_agg AS (
        SELECT
          COALESCE(SUM(gross_revenue_eur), 0) AS gross_revenue_eur,
          COALESCE(SUM(net_revenue_eur), 0) AS net_revenue_eur,
          COALESCE(SUM(refunds_eur), 0) AS refunds_eur,
          COALESCE(SUM(disputes_eur), 0) AS disputes_eur,
          COALESCE(SUM(payment_fees_eur), 0) AS payment_fees_eur
        FROM ${pnlTable}
        ${pnlFilter.whereSql}
      )
      SELECT
        funnel_agg.sessions,
        funnel_agg.test_starts,
        funnel_agg.test_completes,
        funnel_agg.paywall_views,
        funnel_agg.checkout_starts,
        funnel_agg.purchases,
        SAFE_DIVIDE(funnel_agg.purchases, NULLIF(funnel_agg.sessions, 0)) AS paid_conversion,
        pnl_agg.gross_revenue_eur,
        pnl_agg.net_revenue_eur,
        pnl_agg.refunds_eur,
        pnl_agg.disputes_eur,
        pnl_agg.payment_fees_eur
      FROM funnel_agg
      CROSS JOIN pnl_agg
    `,
    params: mergeParams(funnelFilter.params, pnlFilter.params)
  };
};

const buildVisitsTimeseriesQuery = (
  projectId: string,
  datasets: BigQueryAdminAnalyticsDatasets,
  filters: AdminAnalyticsFilters
): BigQueryQuery => {
  const martFilter = buildMartFilterClause(filters);
  const table = `\`${projectId}.${datasets.marts}.mart_funnel_daily\``;

  return {
    query: `
      SELECT
        CAST(date AS STRING) AS date,
        COALESCE(SUM(visits), 0) AS value
      FROM ${table}
      ${martFilter.whereSql}
      GROUP BY date
      ORDER BY date ASC
    `,
    params: martFilter.params
  };
};

const buildRevenueTimeseriesQuery = (
  projectId: string,
  datasets: BigQueryAdminAnalyticsDatasets,
  filters: AdminAnalyticsFilters
): BigQueryQuery => {
  const martFilter = buildMartFilterClause(filters);
  const table = `\`${projectId}.${datasets.marts}.mart_pnl_daily\``;

  return {
    query: `
      SELECT
        CAST(date AS STRING) AS date,
        COALESCE(SUM(net_revenue_eur), 0) AS value
      FROM ${table}
      ${martFilter.whereSql}
      GROUP BY date
      ORDER BY date ASC
    `,
    params: martFilter.params
  };
};

const buildTopTestsQuery = (
  projectId: string,
  datasets: BigQueryAdminAnalyticsDatasets,
  filters: AdminAnalyticsFilters
): BigQueryQuery => {
  const funnelFilter = buildMartFilterClause(filters);
  const pnlFilter = buildMartFilterClause(filters);
  const funnelTable = `\`${projectId}.${datasets.marts}.mart_funnel_daily\``;
  const pnlTable = `\`${projectId}.${datasets.marts}.mart_pnl_daily\``;

  return {
    query: `
      WITH funnel_by_test AS (
        SELECT
          test_id,
          COALESCE(SUM(visits), 0) AS visits,
          COALESCE(SUM(purchases), 0) AS purchases
        FROM ${funnelTable}
        ${funnelFilter.whereSql}
        GROUP BY test_id
      ),
      pnl_by_test AS (
        SELECT
          test_id,
          COALESCE(SUM(net_revenue_eur), 0) AS net_revenue_eur
        FROM ${pnlTable}
        ${pnlFilter.whereSql}
        GROUP BY test_id
      ),
      merged AS (
        SELECT
          COALESCE(funnel_by_test.test_id, pnl_by_test.test_id) AS test_id,
          COALESCE(pnl_by_test.net_revenue_eur, 0) AS net_revenue_eur,
          COALESCE(funnel_by_test.purchases, 0) AS purchases,
          SAFE_DIVIDE(
            COALESCE(funnel_by_test.purchases, 0),
            NULLIF(COALESCE(funnel_by_test.visits, 0), 0)
          ) AS purchase_conversion
        FROM funnel_by_test
        FULL OUTER JOIN pnl_by_test
          ON funnel_by_test.test_id = pnl_by_test.test_id
      )
      SELECT
        test_id,
        net_revenue_eur,
        purchases,
        purchase_conversion
      FROM merged
      WHERE test_id IS NOT NULL
        AND test_id != '__unallocated__'
      ORDER BY net_revenue_eur DESC, purchase_conversion DESC, test_id ASC
      LIMIT ${OVERVIEW_TOP_ROWS_LIMIT}
    `,
    params: mergeParams(funnelFilter.params, pnlFilter.params)
  };
};

const buildTopTenantsQuery = (
  projectId: string,
  datasets: BigQueryAdminAnalyticsDatasets,
  filters: AdminAnalyticsFilters
): BigQueryQuery => {
  const funnelFilter = buildMartFilterClause(filters);
  const pnlFilter = buildMartFilterClause(filters);
  const funnelTable = `\`${projectId}.${datasets.marts}.mart_funnel_daily\``;
  const pnlTable = `\`${projectId}.${datasets.marts}.mart_pnl_daily\``;

  return {
    query: `
      WITH funnel_by_tenant AS (
        SELECT
          tenant_id,
          COALESCE(SUM(purchases), 0) AS purchases
        FROM ${funnelTable}
        ${funnelFilter.whereSql}
        GROUP BY tenant_id
      ),
      pnl_by_tenant AS (
        SELECT
          tenant_id,
          COALESCE(SUM(net_revenue_eur), 0) AS net_revenue_eur
        FROM ${pnlTable}
        ${pnlFilter.whereSql}
        GROUP BY tenant_id
      ),
      merged AS (
        SELECT
          COALESCE(funnel_by_tenant.tenant_id, pnl_by_tenant.tenant_id) AS tenant_id,
          COALESCE(pnl_by_tenant.net_revenue_eur, 0) AS net_revenue_eur,
          COALESCE(funnel_by_tenant.purchases, 0) AS purchases
        FROM funnel_by_tenant
        FULL OUTER JOIN pnl_by_tenant
          ON funnel_by_tenant.tenant_id = pnl_by_tenant.tenant_id
      )
      SELECT
        tenant_id,
        net_revenue_eur,
        purchases
      FROM merged
      WHERE tenant_id IS NOT NULL
        AND tenant_id != '__unallocated__'
      ORDER BY net_revenue_eur DESC, tenant_id ASC
      LIMIT ${OVERVIEW_TOP_ROWS_LIMIT}
    `,
    params: mergeParams(funnelFilter.params, pnlFilter.params)
  };
};

const buildTenantsListQuery = (
  projectId: string,
  datasets: BigQueryAdminAnalyticsDatasets,
  filters: AdminAnalyticsFilters
): BigQueryQuery => {
  const funnelFilter = buildMartFilterClause(filters);
  const pnlFilter = buildMartFilterClause(filters);
  const topTestFilter = buildMartFilterClause(filters);
  const funnelTable = `\`${projectId}.${datasets.marts}.mart_funnel_daily\``;
  const pnlTable = `\`${projectId}.${datasets.marts}.mart_pnl_daily\``;

  return {
    query: `
      WITH funnel_by_tenant AS (
        SELECT
          tenant_id,
          COALESCE(SUM(visits), 0) AS sessions,
          COALESCE(SUM(test_starts), 0) AS test_starts,
          COALESCE(SUM(test_completes), 0) AS test_completes,
          COALESCE(SUM(purchases), 0) AS purchases,
          MAX(date) AS last_funnel_date
        FROM ${funnelTable}
        ${funnelFilter.whereSql}
        GROUP BY tenant_id
      ),
      pnl_by_tenant AS (
        SELECT
          tenant_id,
          COALESCE(SUM(net_revenue_eur), 0) AS net_revenue_eur,
          COALESCE(SUM(refunds_eur), 0) AS refunds_eur,
          MAX(date) AS last_pnl_date
        FROM ${pnlTable}
        ${pnlFilter.whereSql}
        GROUP BY tenant_id
      ),
      top_test_revenue AS (
        SELECT
          tenant_id,
          test_id,
          COALESCE(SUM(net_revenue_eur), 0) AS net_revenue_eur
        FROM ${pnlTable}
        ${topTestFilter.whereSql}
        GROUP BY tenant_id, test_id
      ),
      ranked_top_tests AS (
        SELECT
          tenant_id,
          test_id,
          ROW_NUMBER() OVER (
            PARTITION BY tenant_id
            ORDER BY net_revenue_eur DESC, test_id ASC
          ) AS row_num
        FROM top_test_revenue
        WHERE test_id IS NOT NULL
          AND test_id != '__unallocated__'
      ),
      merged AS (
        SELECT
          COALESCE(funnel_by_tenant.tenant_id, pnl_by_tenant.tenant_id) AS tenant_id,
          COALESCE(funnel_by_tenant.sessions, 0) AS sessions,
          COALESCE(funnel_by_tenant.test_starts, 0) AS test_starts,
          COALESCE(funnel_by_tenant.test_completes, 0) AS test_completes,
          COALESCE(funnel_by_tenant.purchases, 0) AS purchases,
          SAFE_DIVIDE(
            COALESCE(funnel_by_tenant.purchases, 0),
            NULLIF(COALESCE(funnel_by_tenant.sessions, 0), 0)
          ) AS paid_conversion,
          COALESCE(pnl_by_tenant.net_revenue_eur, 0) AS net_revenue_eur,
          COALESCE(pnl_by_tenant.refunds_eur, 0) AS refunds_eur,
          ranked_top_tests.test_id AS top_test_id,
          CASE
            WHEN funnel_by_tenant.last_funnel_date IS NULL AND pnl_by_tenant.last_pnl_date IS NULL THEN NULL
            ELSE CAST(
              GREATEST(
                COALESCE(funnel_by_tenant.last_funnel_date, DATE '1970-01-01'),
                COALESCE(pnl_by_tenant.last_pnl_date, DATE '1970-01-01')
              ) AS STRING
            )
          END AS last_activity_date
        FROM funnel_by_tenant
        FULL OUTER JOIN pnl_by_tenant
          ON funnel_by_tenant.tenant_id = pnl_by_tenant.tenant_id
        LEFT JOIN ranked_top_tests
          ON ranked_top_tests.tenant_id = COALESCE(funnel_by_tenant.tenant_id, pnl_by_tenant.tenant_id)
          AND ranked_top_tests.row_num = 1
      ),
      filtered AS (
        SELECT
          tenant_id,
          sessions,
          test_starts,
          test_completes,
          purchases,
          paid_conversion,
          net_revenue_eur,
          refunds_eur,
          top_test_id,
          last_activity_date
        FROM merged
        WHERE tenant_id IS NOT NULL
          AND tenant_id != '__unallocated__'
      )
      SELECT
        tenant_id,
        sessions,
        test_starts,
        test_completes,
        purchases,
        paid_conversion,
        net_revenue_eur,
        refunds_eur,
        top_test_id,
        last_activity_date,
        COUNT(*) OVER () AS total_rows
      FROM filtered
      ORDER BY net_revenue_eur DESC, purchases DESC, tenant_id ASC
      LIMIT ${TENANTS_TOP_ROWS_LIMIT}
    `,
    params: mergeParams(funnelFilter.params, pnlFilter.params, topTestFilter.params)
  };
};

const buildTenantTopTestsQuery = (
  projectId: string,
  datasets: BigQueryAdminAnalyticsDatasets,
  filters: AdminAnalyticsFilters
): BigQueryQuery => {
  const funnelFilter = buildMartFilterClause(filters);
  const pnlFilter = buildMartFilterClause(filters);
  const funnelTable = `\`${projectId}.${datasets.marts}.mart_funnel_daily\``;
  const pnlTable = `\`${projectId}.${datasets.marts}.mart_pnl_daily\``;

  return {
    query: `
      WITH funnel_by_test AS (
        SELECT
          test_id,
          COALESCE(SUM(visits), 0) AS sessions,
          COALESCE(SUM(test_starts), 0) AS test_starts,
          COALESCE(SUM(test_completes), 0) AS test_completes,
          COALESCE(SUM(purchases), 0) AS purchases
        FROM ${funnelTable}
        ${funnelFilter.whereSql}
        GROUP BY test_id
      ),
      pnl_by_test AS (
        SELECT
          test_id,
          COALESCE(SUM(net_revenue_eur), 0) AS net_revenue_eur,
          COALESCE(SUM(refunds_eur), 0) AS refunds_eur
        FROM ${pnlTable}
        ${pnlFilter.whereSql}
        GROUP BY test_id
      ),
      merged AS (
        SELECT
          COALESCE(funnel_by_test.test_id, pnl_by_test.test_id) AS test_id,
          COALESCE(funnel_by_test.sessions, 0) AS sessions,
          COALESCE(funnel_by_test.test_starts, 0) AS test_starts,
          COALESCE(funnel_by_test.test_completes, 0) AS test_completes,
          COALESCE(funnel_by_test.purchases, 0) AS purchases,
          SAFE_DIVIDE(
            COALESCE(funnel_by_test.purchases, 0),
            NULLIF(COALESCE(funnel_by_test.sessions, 0), 0)
          ) AS paid_conversion,
          COALESCE(pnl_by_test.net_revenue_eur, 0) AS net_revenue_eur,
          COALESCE(pnl_by_test.refunds_eur, 0) AS refunds_eur
        FROM funnel_by_test
        FULL OUTER JOIN pnl_by_test
          ON funnel_by_test.test_id = pnl_by_test.test_id
      )
      SELECT
        test_id,
        sessions,
        test_starts,
        test_completes,
        purchases,
        paid_conversion,
        net_revenue_eur,
        refunds_eur,
        COUNT(*) OVER () AS total_rows
      FROM merged
      WHERE test_id IS NOT NULL
        AND test_id != '__unallocated__'
      ORDER BY net_revenue_eur DESC, purchases DESC, test_id ASC
      LIMIT ${TENANTS_TOP_ROWS_LIMIT}
    `,
    params: mergeParams(funnelFilter.params, pnlFilter.params)
  };
};

const buildTenantLocaleBreakdownQuery = (
  projectId: string,
  datasets: BigQueryAdminAnalyticsDatasets,
  filters: AdminAnalyticsFilters
): BigQueryQuery => {
  const funnelFilter = buildMartFilterClause(filters);
  const pnlFilter = buildMartFilterClause(filters);
  const funnelTable = `\`${projectId}.${datasets.marts}.mart_funnel_daily\``;
  const pnlTable = `\`${projectId}.${datasets.marts}.mart_pnl_daily\``;

  return {
    query: `
      WITH funnel_by_locale AS (
        SELECT
          COALESCE(locale, 'unknown') AS locale,
          COALESCE(SUM(visits), 0) AS sessions,
          COALESCE(SUM(test_starts), 0) AS test_starts,
          COALESCE(SUM(test_completes), 0) AS test_completes,
          COALESCE(SUM(purchases), 0) AS purchases
        FROM ${funnelTable}
        ${funnelFilter.whereSql}
        GROUP BY locale
      ),
      pnl_by_locale AS (
        SELECT
          COALESCE(locale, 'unknown') AS locale,
          COALESCE(SUM(net_revenue_eur), 0) AS net_revenue_eur,
          COALESCE(SUM(refunds_eur), 0) AS refunds_eur
        FROM ${pnlTable}
        ${pnlFilter.whereSql}
        GROUP BY locale
      ),
      merged AS (
        SELECT
          COALESCE(funnel_by_locale.locale, pnl_by_locale.locale) AS locale,
          COALESCE(funnel_by_locale.sessions, 0) AS sessions,
          COALESCE(funnel_by_locale.test_starts, 0) AS test_starts,
          COALESCE(funnel_by_locale.test_completes, 0) AS test_completes,
          COALESCE(funnel_by_locale.purchases, 0) AS purchases,
          SAFE_DIVIDE(
            COALESCE(funnel_by_locale.purchases, 0),
            NULLIF(COALESCE(funnel_by_locale.sessions, 0), 0)
          ) AS paid_conversion,
          COALESCE(pnl_by_locale.net_revenue_eur, 0) AS net_revenue_eur,
          COALESCE(pnl_by_locale.refunds_eur, 0) AS refunds_eur
        FROM funnel_by_locale
        FULL OUTER JOIN pnl_by_locale
          ON funnel_by_locale.locale = pnl_by_locale.locale
      )
      SELECT
        locale,
        sessions,
        test_starts,
        test_completes,
        purchases,
        paid_conversion,
        net_revenue_eur,
        refunds_eur,
        COUNT(*) OVER () AS total_rows
      FROM merged
      ORDER BY net_revenue_eur DESC, purchases DESC, locale ASC
      LIMIT ${TENANTS_TOP_ROWS_LIMIT}
    `,
    params: mergeParams(funnelFilter.params, pnlFilter.params)
  };
};

const buildDistributionTopTenantsQuery = (
  projectId: string,
  datasets: BigQueryAdminAnalyticsDatasets,
  filters: AdminAnalyticsFilters,
  topTenants: number
): BigQueryQuery => {
  const funnelFilter = buildMartFilterClause(filters);
  const pnlFilter = buildMartFilterClause(filters);
  const funnelTable = `\`${projectId}.${datasets.marts}.mart_funnel_daily\``;
  const pnlTable = `\`${projectId}.${datasets.marts}.mart_pnl_daily\``;

  return {
    query: `
      WITH funnel_by_tenant AS (
        SELECT
          tenant_id,
          COALESCE(SUM(purchases), 0) AS purchases
        FROM ${funnelTable}
        ${funnelFilter.whereSql}
        GROUP BY tenant_id
      ),
      pnl_by_tenant AS (
        SELECT
          tenant_id,
          COALESCE(SUM(net_revenue_eur), 0) AS net_revenue_eur_7d
        FROM ${pnlTable}
        ${pnlFilter.whereSql}
        GROUP BY tenant_id
      ),
      merged AS (
        SELECT
          COALESCE(funnel_by_tenant.tenant_id, pnl_by_tenant.tenant_id) AS tenant_id,
          COALESCE(pnl_by_tenant.net_revenue_eur_7d, 0) AS net_revenue_eur_7d,
          COALESCE(funnel_by_tenant.purchases, 0) AS purchases
        FROM funnel_by_tenant
        FULL OUTER JOIN pnl_by_tenant
          ON funnel_by_tenant.tenant_id = pnl_by_tenant.tenant_id
      )
      SELECT
        tenant_id,
        net_revenue_eur_7d
      FROM merged
      WHERE tenant_id IS NOT NULL
        AND tenant_id != '__unallocated__'
      ORDER BY net_revenue_eur_7d DESC, purchases DESC, tenant_id ASC
      LIMIT ${topTenants}
    `,
    params: mergeParams(funnelFilter.params, pnlFilter.params)
  };
};

const buildDistributionTopTestsQuery = (
  projectId: string,
  datasets: BigQueryAdminAnalyticsDatasets,
  filters: AdminAnalyticsFilters,
  topTests: number
): BigQueryQuery => {
  const funnelFilter = buildMartFilterClause(filters);
  const pnlFilter = buildMartFilterClause(filters);
  const funnelTable = `\`${projectId}.${datasets.marts}.mart_funnel_daily\``;
  const pnlTable = `\`${projectId}.${datasets.marts}.mart_pnl_daily\``;

  return {
    query: `
      WITH funnel_by_test AS (
        SELECT
          test_id,
          COALESCE(SUM(purchases), 0) AS purchases
        FROM ${funnelTable}
        ${funnelFilter.whereSql}
        GROUP BY test_id
      ),
      pnl_by_test AS (
        SELECT
          test_id,
          COALESCE(SUM(net_revenue_eur), 0) AS net_revenue_eur_7d
        FROM ${pnlTable}
        ${pnlFilter.whereSql}
        GROUP BY test_id
      ),
      merged AS (
        SELECT
          COALESCE(funnel_by_test.test_id, pnl_by_test.test_id) AS test_id,
          COALESCE(pnl_by_test.net_revenue_eur_7d, 0) AS net_revenue_eur_7d,
          COALESCE(funnel_by_test.purchases, 0) AS purchases
        FROM funnel_by_test
        FULL OUTER JOIN pnl_by_test
          ON funnel_by_test.test_id = pnl_by_test.test_id
      )
      SELECT
        test_id,
        net_revenue_eur_7d
      FROM merged
      WHERE test_id IS NOT NULL
        AND test_id != '__unallocated__'
      ORDER BY net_revenue_eur_7d DESC, purchases DESC, test_id ASC
      LIMIT ${topTests}
    `,
    params: mergeParams(funnelFilter.params, pnlFilter.params)
  };
};

const buildDistributionMatrixMetricsQuery = (
  projectId: string,
  datasets: BigQueryAdminAnalyticsDatasets,
  filters: AdminAnalyticsFilters,
  tenantIds: string[],
  testIds: string[]
): BigQueryQuery => {
  const funnelFilter = buildMartFilterClause(filters);
  const pnlFilter = buildMartFilterClause(filters);
  const funnelTable = `\`${projectId}.${datasets.marts}.mart_funnel_daily\``;
  const pnlTable = `\`${projectId}.${datasets.marts}.mart_pnl_daily\``;
  const scopeParams = {
    tenant_ids: tenantIds,
    test_ids: testIds
  };

  return {
    query: `
      WITH selected_tenants AS (
        SELECT tenant_id, tenant_order
        FROM UNNEST(@tenant_ids) AS tenant_id WITH OFFSET AS tenant_order
      ),
      selected_tests AS (
        SELECT test_id, test_order
        FROM UNNEST(@test_ids) AS test_id WITH OFFSET AS test_order
      ),
      funnel_by_cell AS (
        SELECT
          tenant_id,
          test_id,
          COALESCE(SUM(visits), 0) AS visits,
          COALESCE(SUM(purchases), 0) AS purchases
        FROM ${funnelTable}
        ${funnelFilter.whereSql}
          AND tenant_id IN UNNEST(@tenant_ids)
          AND test_id IN UNNEST(@test_ids)
        GROUP BY tenant_id, test_id
      ),
      pnl_by_cell AS (
        SELECT
          tenant_id,
          test_id,
          COALESCE(SUM(net_revenue_eur), 0) AS net_revenue_eur_7d
        FROM ${pnlTable}
        ${pnlFilter.whereSql}
          AND tenant_id IN UNNEST(@tenant_ids)
          AND test_id IN UNNEST(@test_ids)
        GROUP BY tenant_id, test_id
      )
      SELECT
        selected_tenants.tenant_id,
        selected_tests.test_id,
        COALESCE(pnl_by_cell.net_revenue_eur_7d, 0) AS net_revenue_eur_7d,
        SAFE_DIVIDE(
          COALESCE(funnel_by_cell.purchases, 0),
          NULLIF(COALESCE(funnel_by_cell.visits, 0), 0)
        ) AS paid_conversion_7d
      FROM selected_tenants
      CROSS JOIN selected_tests
      LEFT JOIN funnel_by_cell
        ON funnel_by_cell.tenant_id = selected_tenants.tenant_id
        AND funnel_by_cell.test_id = selected_tests.test_id
      LEFT JOIN pnl_by_cell
        ON pnl_by_cell.tenant_id = selected_tenants.tenant_id
        AND pnl_by_cell.test_id = selected_tests.test_id
      ORDER BY selected_tenants.tenant_order ASC, selected_tests.test_order ASC
    `,
    params: mergeParams(funnelFilter.params, pnlFilter.params, scopeParams)
  };
};

const buildTestsListQuery = (
  projectId: string,
  datasets: BigQueryAdminAnalyticsDatasets,
  filters: AdminAnalyticsFilters
): BigQueryQuery => {
  const funnelFilter = buildMartFilterClause(filters);
  const pnlFilter = buildMartFilterClause(filters);
  const topTenantFilter = buildMartFilterClause(filters);
  const funnelTable = `\`${projectId}.${datasets.marts}.mart_funnel_daily\``;
  const pnlTable = `\`${projectId}.${datasets.marts}.mart_pnl_daily\``;

  return {
    query: `
      WITH funnel_by_test AS (
        SELECT
          test_id,
          COALESCE(SUM(visits), 0) AS sessions,
          COALESCE(SUM(test_starts), 0) AS starts,
          COALESCE(SUM(test_completes), 0) AS completes,
          COALESCE(SUM(purchases), 0) AS purchases
        FROM ${funnelTable}
        ${funnelFilter.whereSql}
        GROUP BY test_id
      ),
      pnl_by_test AS (
        SELECT
          test_id,
          COALESCE(SUM(net_revenue_eur), 0) AS net_revenue_eur,
          COALESCE(SUM(refunds_eur), 0) AS refunds_eur
        FROM ${pnlTable}
        ${pnlFilter.whereSql}
        GROUP BY test_id
      ),
      tenant_revenue AS (
        SELECT
          test_id,
          tenant_id,
          COALESCE(SUM(net_revenue_eur), 0) AS net_revenue_eur
        FROM ${pnlTable}
        ${topTenantFilter.whereSql}
        GROUP BY test_id, tenant_id
      ),
      ranked_tenants AS (
        SELECT
          test_id,
          tenant_id,
          ROW_NUMBER() OVER (
            PARTITION BY test_id
            ORDER BY net_revenue_eur DESC, tenant_id ASC
          ) AS row_num
        FROM tenant_revenue
        WHERE test_id IS NOT NULL
          AND test_id != '__unallocated__'
          AND tenant_id IS NOT NULL
          AND tenant_id != '__unallocated__'
      ),
      last_activity AS (
        SELECT
          test_id,
          CAST(MAX(activity_date) AS STRING) AS last_activity_date
        FROM (
          SELECT
            test_id,
            date AS activity_date
          FROM ${funnelTable}
          ${funnelFilter.whereSql}
          UNION ALL
          SELECT
            test_id,
            date AS activity_date
          FROM ${pnlTable}
          ${pnlFilter.whereSql}
        )
        GROUP BY test_id
      ),
      merged AS (
        SELECT
          COALESCE(funnel_by_test.test_id, pnl_by_test.test_id) AS test_id,
          COALESCE(funnel_by_test.sessions, 0) AS sessions,
          COALESCE(funnel_by_test.starts, 0) AS starts,
          COALESCE(funnel_by_test.completes, 0) AS completes,
          COALESCE(funnel_by_test.purchases, 0) AS purchases,
          SAFE_DIVIDE(
            COALESCE(funnel_by_test.purchases, 0),
            NULLIF(COALESCE(funnel_by_test.sessions, 0), 0)
          ) AS paid_conversion,
          COALESCE(pnl_by_test.net_revenue_eur, 0) AS net_revenue_eur,
          COALESCE(pnl_by_test.refunds_eur, 0) AS refunds_eur
        FROM funnel_by_test
        FULL OUTER JOIN pnl_by_test
          ON funnel_by_test.test_id = pnl_by_test.test_id
      )
      SELECT
        merged.test_id,
        merged.sessions,
        merged.starts,
        merged.completes,
        merged.purchases,
        merged.paid_conversion,
        merged.net_revenue_eur,
        merged.refunds_eur,
        ranked_tenants.tenant_id AS top_tenant_id,
        last_activity.last_activity_date
      FROM merged
      LEFT JOIN ranked_tenants
        ON ranked_tenants.test_id = merged.test_id
        AND ranked_tenants.row_num = 1
      LEFT JOIN last_activity
        ON last_activity.test_id = merged.test_id
      WHERE merged.test_id IS NOT NULL
        AND merged.test_id != '__unallocated__'
      ORDER BY merged.net_revenue_eur DESC, merged.purchases DESC, merged.test_id ASC
      LIMIT ${TESTS_TOP_ROWS_LIMIT}
    `,
    params: mergeParams(funnelFilter.params, pnlFilter.params, topTenantFilter.params)
  };
};

const buildTestDailyTimeseriesQuery = (
  projectId: string,
  datasets: BigQueryAdminAnalyticsDatasets,
  filters: AdminAnalyticsFilters
): BigQueryQuery => {
  const funnelFilter = buildMartFilterClause(filters);
  const pnlFilter = buildMartFilterClause(filters);
  const funnelTable = `\`${projectId}.${datasets.marts}.mart_funnel_daily\``;
  const pnlTable = `\`${projectId}.${datasets.marts}.mart_pnl_daily\``;

  return {
    query: `
      WITH funnel_daily AS (
        SELECT
          date,
          COALESCE(SUM(visits), 0) AS sessions,
          COALESCE(SUM(test_completes), 0) AS completes,
          COALESCE(SUM(purchases), 0) AS purchases
        FROM ${funnelTable}
        ${funnelFilter.whereSql}
        GROUP BY date
      ),
      pnl_daily AS (
        SELECT
          date,
          COALESCE(SUM(net_revenue_eur), 0) AS net_revenue_eur
        FROM ${pnlTable}
        ${pnlFilter.whereSql}
        GROUP BY date
      )
      SELECT
        CAST(COALESCE(funnel_daily.date, pnl_daily.date) AS STRING) AS date,
        COALESCE(funnel_daily.sessions, 0) AS sessions,
        COALESCE(funnel_daily.completes, 0) AS completes,
        COALESCE(funnel_daily.purchases, 0) AS purchases,
        COALESCE(pnl_daily.net_revenue_eur, 0) AS net_revenue_eur
      FROM funnel_daily
      FULL OUTER JOIN pnl_daily
        ON funnel_daily.date = pnl_daily.date
      ORDER BY date ASC
    `,
    params: mergeParams(funnelFilter.params, pnlFilter.params)
  };
};

const buildTestTenantBreakdownQuery = (
  projectId: string,
  datasets: BigQueryAdminAnalyticsDatasets,
  filters: AdminAnalyticsFilters
): BigQueryQuery => {
  const funnelFilter = buildMartFilterClause(filters);
  const pnlFilter = buildMartFilterClause(filters);
  const funnelTable = `\`${projectId}.${datasets.marts}.mart_funnel_daily\``;
  const pnlTable = `\`${projectId}.${datasets.marts}.mart_pnl_daily\``;

  return {
    query: `
      WITH funnel_by_tenant AS (
        SELECT
          tenant_id,
          COALESCE(SUM(visits), 0) AS sessions,
          COALESCE(SUM(test_starts), 0) AS starts,
          COALESCE(SUM(test_completes), 0) AS completes,
          COALESCE(SUM(purchases), 0) AS purchases
        FROM ${funnelTable}
        ${funnelFilter.whereSql}
        GROUP BY tenant_id
      ),
      pnl_by_tenant AS (
        SELECT
          tenant_id,
          COALESCE(SUM(net_revenue_eur), 0) AS net_revenue_eur,
          COALESCE(SUM(refunds_eur), 0) AS refunds_eur
        FROM ${pnlTable}
        ${pnlFilter.whereSql}
        GROUP BY tenant_id
      ),
      merged AS (
        SELECT
          COALESCE(funnel_by_tenant.tenant_id, pnl_by_tenant.tenant_id) AS tenant_id,
          COALESCE(funnel_by_tenant.sessions, 0) AS sessions,
          COALESCE(funnel_by_tenant.starts, 0) AS starts,
          COALESCE(funnel_by_tenant.completes, 0) AS completes,
          COALESCE(funnel_by_tenant.purchases, 0) AS purchases,
          SAFE_DIVIDE(
            COALESCE(funnel_by_tenant.purchases, 0),
            NULLIF(COALESCE(funnel_by_tenant.sessions, 0), 0)
          ) AS paid_conversion,
          COALESCE(pnl_by_tenant.net_revenue_eur, 0) AS net_revenue_eur,
          COALESCE(pnl_by_tenant.refunds_eur, 0) AS refunds_eur
        FROM funnel_by_tenant
        FULL OUTER JOIN pnl_by_tenant
          ON funnel_by_tenant.tenant_id = pnl_by_tenant.tenant_id
      )
      SELECT
        tenant_id,
        sessions,
        starts,
        completes,
        purchases,
        paid_conversion,
        net_revenue_eur,
        refunds_eur
      FROM merged
      WHERE tenant_id IS NOT NULL
        AND tenant_id != '__unallocated__'
      ORDER BY net_revenue_eur DESC, purchases DESC, tenant_id ASC
      LIMIT ${TEST_BREAKDOWN_ROWS_LIMIT}
    `,
    params: mergeParams(funnelFilter.params, pnlFilter.params)
  };
};

const buildTestLocaleBreakdownQuery = (
  projectId: string,
  datasets: BigQueryAdminAnalyticsDatasets,
  filters: AdminAnalyticsFilters
): BigQueryQuery => {
  const funnelFilter = buildMartFilterClause(filters);
  const pnlFilter = buildMartFilterClause(filters);
  const funnelTable = `\`${projectId}.${datasets.marts}.mart_funnel_daily\``;
  const pnlTable = `\`${projectId}.${datasets.marts}.mart_pnl_daily\``;

  return {
    query: `
      WITH funnel_by_locale AS (
        SELECT
          COALESCE(locale, 'unknown') AS locale,
          COALESCE(SUM(visits), 0) AS sessions,
          COALESCE(SUM(test_starts), 0) AS starts,
          COALESCE(SUM(test_completes), 0) AS completes,
          COALESCE(SUM(purchases), 0) AS purchases
        FROM ${funnelTable}
        ${funnelFilter.whereSql}
        GROUP BY locale
      ),
      pnl_by_locale AS (
        SELECT
          COALESCE(locale, 'unknown') AS locale,
          COALESCE(SUM(net_revenue_eur), 0) AS net_revenue_eur,
          COALESCE(SUM(refunds_eur), 0) AS refunds_eur
        FROM ${pnlTable}
        ${pnlFilter.whereSql}
        GROUP BY locale
      ),
      merged AS (
        SELECT
          COALESCE(funnel_by_locale.locale, pnl_by_locale.locale) AS locale,
          COALESCE(funnel_by_locale.sessions, 0) AS sessions,
          COALESCE(funnel_by_locale.starts, 0) AS starts,
          COALESCE(funnel_by_locale.completes, 0) AS completes,
          COALESCE(funnel_by_locale.purchases, 0) AS purchases,
          SAFE_DIVIDE(
            COALESCE(funnel_by_locale.purchases, 0),
            NULLIF(COALESCE(funnel_by_locale.sessions, 0), 0)
          ) AS paid_conversion,
          COALESCE(pnl_by_locale.net_revenue_eur, 0) AS net_revenue_eur,
          COALESCE(pnl_by_locale.refunds_eur, 0) AS refunds_eur
        FROM funnel_by_locale
        FULL OUTER JOIN pnl_by_locale
          ON funnel_by_locale.locale = pnl_by_locale.locale
      )
      SELECT
        locale,
        sessions,
        starts,
        completes,
        purchases,
        paid_conversion,
        net_revenue_eur,
        refunds_eur
      FROM merged
      ORDER BY net_revenue_eur DESC, purchases DESC, locale ASC
      LIMIT ${TEST_BREAKDOWN_ROWS_LIMIT}
    `,
    params: mergeParams(funnelFilter.params, pnlFilter.params)
  };
};

const buildTestPaywallMetricsQuery = (
  projectId: string,
  datasets: BigQueryAdminAnalyticsDatasets,
  filters: AdminAnalyticsFilters
): BigQueryQuery => {
  const funnelFilter = buildMartFilterClause(filters);
  const funnelTable = `\`${projectId}.${datasets.marts}.mart_funnel_daily\``;

  return {
    query: `
      SELECT
        COALESCE(SUM(paywall_views), 0) AS views,
        COALESCE(SUM(checkout_starts), 0) AS checkout_starts,
        COALESCE(SUM(purchases), 0) AS checkout_success,
        SAFE_DIVIDE(
          COALESCE(SUM(checkout_starts), 0),
          NULLIF(COALESCE(SUM(paywall_views), 0), 0)
        ) AS checkout_start_rate,
        SAFE_DIVIDE(
          COALESCE(SUM(purchases), 0),
          NULLIF(COALESCE(SUM(checkout_starts), 0), 0)
        ) AS checkout_success_rate
      FROM ${funnelTable}
      ${funnelFilter.whereSql}
    `,
    params: funnelFilter.params
  };
};

const buildOverviewKpis = (aggregate: OverviewAggregateRow): KpiCard[] => {
  return [
    {
      key: "sessions",
      label: "Sessions",
      value: aggregate.sessions,
      unit: "count",
      delta: null
    },
    {
      key: "test_starts",
      label: "Test starts",
      value: aggregate.test_starts,
      unit: "count",
      delta: null
    },
    {
      key: "test_completes",
      label: "Test completes",
      value: aggregate.test_completes,
      unit: "count",
      delta: null
    },
    {
      key: "purchases",
      label: "Purchases",
      value: aggregate.purchases,
      unit: "count",
      delta: null
    },
    {
      key: "paid_conversion",
      label: "Paid conversion",
      value: aggregate.paid_conversion,
      unit: "ratio",
      delta: null
    },
    {
      key: "gross_revenue_eur",
      label: "Gross revenue (EUR)",
      value: aggregate.gross_revenue_eur,
      unit: "currency_eur",
      delta: null
    },
    {
      key: "net_revenue_eur",
      label: "Net revenue (EUR)",
      value: aggregate.net_revenue_eur,
      unit: "currency_eur",
      delta: null
    },
    {
      key: "refunds_eur",
      label: "Refunds (EUR)",
      value: aggregate.refunds_eur,
      unit: "currency_eur",
      delta: null
    },
    {
      key: "disputes_eur",
      label: "Disputes (EUR)",
      value: aggregate.disputes_eur,
      unit: "currency_eur",
      delta: null
    },
    {
      key: "payment_fees_eur",
      label: "Payment fees (EUR)",
      value: aggregate.payment_fees_eur,
      unit: "currency_eur",
      delta: null
    }
  ];
};

const buildOverviewFunnel = (aggregate: OverviewAggregateRow): FunnelStep[] => {
  return [
    {
      key: "sessions",
      label: "Sessions",
      count: aggregate.sessions,
      conversion_rate: null
    },
    {
      key: "test_starts",
      label: "Test starts",
      count: aggregate.test_starts,
      conversion_rate: safeRatio(aggregate.test_starts, aggregate.sessions)
    },
    {
      key: "test_completes",
      label: "Test completes",
      count: aggregate.test_completes,
      conversion_rate: safeRatio(aggregate.test_completes, aggregate.test_starts)
    },
    {
      key: "paywall_views",
      label: "Paywall views",
      count: aggregate.paywall_views,
      conversion_rate: safeRatio(aggregate.paywall_views, aggregate.test_completes)
    },
    {
      key: "checkout_starts",
      label: "Checkout starts",
      count: aggregate.checkout_starts,
      conversion_rate: safeRatio(aggregate.checkout_starts, aggregate.paywall_views)
    },
    {
      key: "purchases",
      label: "Purchases",
      count: aggregate.purchases,
      conversion_rate: safeRatio(aggregate.purchases, aggregate.sessions)
    }
  ];
};

export class BigQueryAdminAnalyticsProvider implements AdminAnalyticsProvider {
  constructor(
    private readonly bigquery: BigQueryClientLike,
    private readonly projectId: string,
    private readonly datasets: BigQueryAdminAnalyticsDatasets
  ) {}

  private notImplemented(method: string): AdminAnalyticsNotImplementedError {
    return new AdminAnalyticsNotImplementedError(
      `BigQuery admin analytics method '${method}' is not implemented (project=${this.projectId}, datasets=${JSON.stringify(this.datasets)}).`
    );
  }

  private table(table: string): string {
    return `\`${this.projectId}.${this.datasets.marts}.${table}\``;
  }

  private async runQuery<T extends BigQueryRow>(
    query: string,
    params: Record<string, unknown>
  ): Promise<T[]> {
    const [job] = await this.bigquery.createQueryJob({
      query,
      params,
      useLegacySql: false
    });
    const [rows] = await job.getQueryResults();
    return rows as T[];
  }

  private async fetchOverviewAggregate(filters: AdminAnalyticsFilters): Promise<OverviewAggregateRow> {
    const built = buildOverviewAggregateQuery(this.projectId, this.datasets, filters);
    const [row] = await this.runQuery<BigQueryRow>(built.query, built.params);
    const source = row ?? {};

    return {
      sessions: asNumber(source.sessions),
      test_starts: asNumber(source.test_starts),
      test_completes: asNumber(source.test_completes),
      paywall_views: asNumber(source.paywall_views),
      checkout_starts: asNumber(source.checkout_starts),
      purchases: asNumber(source.purchases),
      paid_conversion: asNumber(source.paid_conversion),
      gross_revenue_eur: asNumber(source.gross_revenue_eur),
      net_revenue_eur: asNumber(source.net_revenue_eur),
      refunds_eur: asNumber(source.refunds_eur),
      disputes_eur: asNumber(source.disputes_eur),
      payment_fees_eur: asNumber(source.payment_fees_eur)
    };
  }

  private async fetchVisitsTimeseries(filters: AdminAnalyticsFilters): Promise<TimeseriesPoint[]> {
    const built = buildVisitsTimeseriesQuery(this.projectId, this.datasets, filters);
    const rows = await this.runQuery<BigQueryRow>(built.query, built.params);
    return rows.map((row) => ({
      date: asNullableString(row.date) ?? "",
      value: asNumber(row.value)
    }));
  }

  private async fetchRevenueTimeseries(filters: AdminAnalyticsFilters): Promise<TimeseriesPoint[]> {
    const built = buildRevenueTimeseriesQuery(this.projectId, this.datasets, filters);
    const rows = await this.runQuery<BigQueryRow>(built.query, built.params);
    return rows.map((row) => ({
      date: asNullableString(row.date) ?? "",
      value: asNumber(row.value)
    }));
  }

  private async fetchTopTests(
    filters: AdminAnalyticsFilters
  ): Promise<AdminAnalyticsOverviewResponse["top_tests"]> {
    const built = buildTopTestsQuery(this.projectId, this.datasets, filters);
    const rows = await this.runQuery<BigQueryRow>(built.query, built.params);
    return rows.map((row) => ({
      test_id: asNullableString(row.test_id) ?? "",
      net_revenue_eur: asNumber(row.net_revenue_eur),
      purchase_conversion: asNumber(row.purchase_conversion),
      purchases: asNumber(row.purchases)
    }));
  }

  private async fetchTopTenants(
    filters: AdminAnalyticsFilters
  ): Promise<AdminAnalyticsOverviewResponse["top_tenants"]> {
    const built = buildTopTenantsQuery(this.projectId, this.datasets, filters);
    const rows = await this.runQuery<BigQueryRow>(built.query, built.params);
    return rows.map((row) => ({
      tenant_id: asNullableString(row.tenant_id) ?? "",
      net_revenue_eur: asNumber(row.net_revenue_eur),
      purchases: asNumber(row.purchases)
    }));
  }

  private async fetchTestsRows(
    filters: AdminAnalyticsFilters
  ): Promise<AdminAnalyticsTestsResponse["rows"]> {
    const built = buildTestsListQuery(this.projectId, this.datasets, filters);
    const rows = await this.runQuery<BigQueryRow>(built.query, built.params);

    return rows.map((row) => {
      const slug = asNullableString(row.slug);
      return {
        test_id: asNullableString(row.test_id) ?? "",
        ...(slug ? { slug } : {}),
        sessions: asNumber(row.sessions),
        starts: asNumber(row.starts),
        completes: asNumber(row.completes),
        purchases: asNumber(row.purchases),
        paid_conversion: asNumber(row.paid_conversion),
        net_revenue_eur: asNumber(row.net_revenue_eur),
        refunds_eur: asNumber(row.refunds_eur),
        top_tenant_id: asNullableString(row.top_tenant_id),
        last_activity_date: asNullableString(row.last_activity_date)
      };
    });
  }

  private async fetchTestTimeseries(
    filters: AdminAnalyticsFilters
  ): Promise<AdminAnalyticsTestTimeseriesRow[]> {
    const built = buildTestDailyTimeseriesQuery(this.projectId, this.datasets, filters);
    const rows = await this.runQuery<BigQueryRow>(built.query, built.params);
    return rows.map((row) => ({
      date: asNullableString(row.date) ?? "",
      sessions: asNumber(row.sessions),
      completes: asNumber(row.completes),
      purchases: asNumber(row.purchases),
      net_revenue_eur: asNumber(row.net_revenue_eur)
    }));
  }

  private async fetchTestTenantBreakdown(
    filters: AdminAnalyticsFilters
  ): Promise<AdminAnalyticsTestTenantRow[]> {
    const built = buildTestTenantBreakdownQuery(this.projectId, this.datasets, filters);
    const rows = await this.runQuery<BigQueryRow>(built.query, built.params);
    return rows.map((row) => ({
      tenant_id: asNullableString(row.tenant_id) ?? "",
      sessions: asNumber(row.sessions),
      starts: asNumber(row.starts),
      completes: asNumber(row.completes),
      purchases: asNumber(row.purchases),
      paid_conversion: asNumber(row.paid_conversion),
      net_revenue_eur: asNumber(row.net_revenue_eur),
      refunds_eur: asNumber(row.refunds_eur)
    }));
  }

  private async fetchTestLocaleBreakdown(
    filters: AdminAnalyticsFilters
  ): Promise<AdminAnalyticsTestLocaleRow[]> {
    const built = buildTestLocaleBreakdownQuery(this.projectId, this.datasets, filters);
    const rows = await this.runQuery<BigQueryRow>(built.query, built.params);
    return rows.map((row) => ({
      locale: asNullableString(row.locale) ?? "unknown",
      sessions: asNumber(row.sessions),
      starts: asNumber(row.starts),
      completes: asNumber(row.completes),
      purchases: asNumber(row.purchases),
      paid_conversion: asNumber(row.paid_conversion),
      net_revenue_eur: asNumber(row.net_revenue_eur),
      refunds_eur: asNumber(row.refunds_eur)
    }));
  }

  private async fetchTestPaywallMetrics(
    filters: AdminAnalyticsFilters
  ): Promise<{ available: boolean; metrics: AdminAnalyticsTestPaywallMetrics | null }> {
    const built = buildTestPaywallMetricsQuery(this.projectId, this.datasets, filters);
    try {
      const [row] = await this.runQuery<BigQueryRow>(built.query, built.params);
      const source = row ?? {};
      return {
        available: true,
        metrics: {
          views: asNumber(source.views),
          checkout_starts: asNumber(source.checkout_starts),
          checkout_success: asNumber(source.checkout_success),
          checkout_start_rate: asNumber(source.checkout_start_rate),
          checkout_success_rate: asNumber(source.checkout_success_rate)
        }
      };
    } catch (error) {
      if (isNotFoundError(error)) {
        return {
          available: false,
          metrics: null
        };
      }

      throw error;
    }
  }

  private async fetchTenantsRows(
    filters: AdminAnalyticsFilters
  ): Promise<{ rows: AdminAnalyticsTenantsRow[]; totalRows: number }> {
    const built = buildTenantsListQuery(this.projectId, this.datasets, filters);
    const rows = await this.runQuery<BigQueryRow>(built.query, built.params);
    const totalRows = rows.length > 0 ? asNumber(rows[0].total_rows) : 0;

    return {
      rows: rows.map((row) => ({
        tenant_id: asNullableString(row.tenant_id) ?? "",
        sessions: asNumber(row.sessions),
        test_starts: asNumber(row.test_starts),
        test_completions: asNumber(row.test_completes),
        purchases: asNumber(row.purchases),
        paid_conversion: asNumber(row.paid_conversion),
        net_revenue_eur: asNumber(row.net_revenue_eur),
        refunds_eur: asNumber(row.refunds_eur),
        top_test_id: asNullableString(row.top_test_id),
        last_activity_date: asNullableString(row.last_activity_date)
      })),
      totalRows
    };
  }

  private async fetchTenantTopTests(
    filters: AdminAnalyticsFilters
  ): Promise<{ rows: AdminAnalyticsTenantTopTestRow[]; totalRows: number }> {
    const built = buildTenantTopTestsQuery(this.projectId, this.datasets, filters);
    const rows = await this.runQuery<BigQueryRow>(built.query, built.params);
    const totalRows = rows.length > 0 ? asNumber(rows[0].total_rows) : 0;

    return {
      rows: rows.map((row) => ({
        test_id: asNullableString(row.test_id) ?? "",
        sessions: asNumber(row.sessions),
        test_starts: asNumber(row.test_starts),
        test_completions: asNumber(row.test_completes),
        purchases: asNumber(row.purchases),
        paid_conversion: asNumber(row.paid_conversion),
        net_revenue_eur: asNumber(row.net_revenue_eur),
        refunds_eur: asNumber(row.refunds_eur)
      })),
      totalRows
    };
  }

  private async fetchTenantLocaleBreakdown(
    filters: AdminAnalyticsFilters
  ): Promise<{ rows: AdminAnalyticsTenantLocaleRow[]; totalRows: number }> {
    const built = buildTenantLocaleBreakdownQuery(this.projectId, this.datasets, filters);
    const rows = await this.runQuery<BigQueryRow>(built.query, built.params);
    const totalRows = rows.length > 0 ? asNumber(rows[0].total_rows) : 0;

    return {
      rows: rows.map((row) => ({
        locale: asNullableString(row.locale) ?? "unknown",
        sessions: asNumber(row.sessions),
        test_starts: asNumber(row.test_starts),
        test_completions: asNumber(row.test_completes),
        purchases: asNumber(row.purchases),
        paid_conversion: asNumber(row.paid_conversion),
        net_revenue_eur: asNumber(row.net_revenue_eur),
        refunds_eur: asNumber(row.refunds_eur)
      })),
      totalRows
    };
  }

  private async fetchDistributionTopTenants(
    filters: AdminAnalyticsFilters,
    topTenants: number
  ): Promise<DistributionTopTenantRow[]> {
    const built = buildDistributionTopTenantsQuery(
      this.projectId,
      this.datasets,
      filters,
      topTenants
    );
    const rows = await this.runQuery<BigQueryRow>(built.query, built.params);
    return rows
      .map((row) => {
        const tenantId = asNonEmptyString(row.tenant_id);
        if (!tenantId) {
          return null;
        }

        return {
          tenant_id: tenantId,
          net_revenue_eur_7d: asNumber(row.net_revenue_eur_7d)
        };
      })
      .filter((row): row is DistributionTopTenantRow => row !== null);
  }

  private async fetchDistributionTopTests(
    filters: AdminAnalyticsFilters,
    topTests: number
  ): Promise<DistributionTopTestRow[]> {
    const built = buildDistributionTopTestsQuery(
      this.projectId,
      this.datasets,
      filters,
      topTests
    );
    const rows = await this.runQuery<BigQueryRow>(built.query, built.params);
    return rows
      .map((row) => {
        const testId = asNonEmptyString(row.test_id);
        if (!testId) {
          return null;
        }

        return {
          test_id: testId,
          net_revenue_eur_7d: asNumber(row.net_revenue_eur_7d)
        };
      })
      .filter((row): row is DistributionTopTestRow => row !== null);
  }

  private async fetchDistributionMetrics(
    filters: AdminAnalyticsFilters,
    tenantIds: string[],
    testIds: string[]
  ): Promise<Map<string, DistributionMetricRow>> {
    if (tenantIds.length === 0 || testIds.length === 0) {
      return new Map();
    }

    const built = buildDistributionMatrixMetricsQuery(
      this.projectId,
      this.datasets,
      filters,
      tenantIds,
      testIds
    );
    const rows = await this.runQuery<BigQueryRow>(built.query, built.params);
    const byCell = new Map<string, DistributionMetricRow>();

    for (const row of rows) {
      const tenantId = asNonEmptyString(row.tenant_id);
      const testId = asNonEmptyString(row.test_id);
      if (!tenantId || !testId) {
        continue;
      }

      byCell.set(distributionCellKey(tenantId, testId), {
        tenant_id: tenantId,
        test_id: testId,
        net_revenue_eur_7d: asNumber(row.net_revenue_eur_7d),
        paid_conversion_7d: asNumber(row.paid_conversion_7d)
      });
    }

    return byCell;
  }

  private async fetchDistributionPublicationState(
    tenantIds: string[],
    testIds: string[]
  ): Promise<Map<string, DistributionPublicationState>> {
    if (!hasContentDatabaseUrl() || tenantIds.length === 0 || testIds.length === 0) {
      return new Map();
    }

    const pool = getContentDbPool();

    try {
      const { rows } = await pool.query<DistributionPublicationRow>(
        `
          SELECT
            tt.tenant_id,
            t.test_id,
            tt.is_enabled,
            tt.published_version_id AS version_id
          FROM tenant_tests tt
          JOIN tests t
            ON t.id = tt.test_id
          WHERE tt.tenant_id = ANY($1::text[])
            AND t.test_id = ANY($2::text[])
        `,
        [tenantIds, testIds]
      );

      const result = new Map<string, DistributionPublicationState>();
      for (const row of rows) {
        const tenantId = asNonEmptyString(row.tenant_id);
        const testId = asNonEmptyString(row.test_id);
        if (!tenantId || !testId) {
          continue;
        }

        const versionId = asNonEmptyString(row.version_id);
        const enabled = typeof row.is_enabled === "boolean" ? row.is_enabled : null;
        result.set(distributionCellKey(tenantId, testId), {
          is_published: Boolean(versionId && enabled),
          version_id: versionId,
          enabled
        });
      }

      return result;
    } catch {
      return new Map();
    }
  }

  private mapTrafficRows(
    rows: BigQueryRow[],
    includeNetRevenue: boolean
  ): AdminAnalyticsTrafficSegmentRow[] {
    return rows
      .map((row) => {
        const segment = asNonEmptyString(row.segment);
        if (!segment || segment === "__unallocated__") {
          return null;
        }

        return {
          segment,
          sessions: asNumber(row.sessions),
          purchases: asNumber(row.purchases),
          paid_conversion: asNumber(row.paid_conversion),
          net_revenue_eur: includeNetRevenue ? asNumber(row.net_revenue_eur) : 0
        };
      })
      .filter((row): row is AdminAnalyticsTrafficSegmentRow => row !== null);
  }

  private async hasMartColumn(tableName: string, columnName: string): Promise<boolean> {
    const query = `
      /* traffic_column_check */
      SELECT
        COUNT(1) AS column_count
      FROM \`${this.projectId}.${this.datasets.marts}.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = @table_name
        AND column_name = @column_name
    `;

    try {
      const [row] = await this.runQuery<BigQueryRow>(query, {
        table_name: tableName,
        column_name: columnName
      });
      return asNumber(row?.column_count) > 0;
    } catch (error) {
      if (isNotFoundError(error)) {
        return false;
      }

      throw error;
    }
  }

  private async fetchTrafficChannelBreakdown(
    filters: AdminAnalyticsFilters,
    breakdown: TrafficChannelBreakdown,
    topN: number
  ): Promise<AdminAnalyticsTrafficSegmentRow[]> {
    let includeFunnelDeviceTypeFilter = false;
    let includePnlDeviceTypeFilter = false;
    if (filters.device_type !== "all") {
      [includeFunnelDeviceTypeFilter, includePnlDeviceTypeFilter] = await Promise.all([
        this.hasMartColumn("mart_funnel_daily", "device_type"),
        this.hasMartColumn("mart_pnl_daily", "device_type")
      ]);
    }

    const built = buildTrafficChannelBreakdownQuery(
      this.projectId,
      this.datasets,
      filters,
      breakdown,
      topN,
      {
        includeFunnelDeviceTypeFilter,
        includePnlDeviceTypeFilter
      }
    );
    const rows = await this.runQuery<BigQueryRow>(built.query, built.params);
    return this.mapTrafficRows(rows, true);
  }

  private async fetchTrafficFunnelDimensionBreakdown(
    filters: AdminAnalyticsFilters,
    dimension: TrafficFunnelDimension,
    topN: number
  ): Promise<AdminAnalyticsTrafficSegmentRow[]> {
    const hasDimensionColumn = await this.hasMartColumn("mart_funnel_daily", dimension);
    if (!hasDimensionColumn) {
      return [];
    }

    let includeDeviceTypeFilter = false;
    if (filters.device_type !== "all") {
      includeDeviceTypeFilter = dimension === "device_type"
        ? hasDimensionColumn
        : await this.hasMartColumn("mart_funnel_daily", "device_type");
    }

    const built = buildTrafficFunnelDimensionBreakdownQuery(
      this.projectId,
      this.datasets,
      filters,
      dimension,
      topN,
      {
        includeDeviceTypeFilter
      }
    );
    const rows = await this.runQuery<BigQueryRow>(built.query, built.params);
    return this.mapTrafficRows(rows, false);
  }

  private async fetchFreshnessRows(): Promise<AdminAnalyticsOverviewFreshnessRow[]> {
    const cacheKey = `${this.projectId}:${this.datasets.marts}`;
    const now = Date.now();
    const cached = freshnessCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.rows;
    }

    const tables = ["mart_funnel_daily", "mart_pnl_daily", "mart_unit_econ_daily"];
    const rows = await Promise.all(
      tables.map(async (tableName): Promise<AdminAnalyticsOverviewFreshnessRow> => {
        try {
          const query = `
            SELECT CAST(MAX(date) AS STRING) AS max_date
            FROM ${this.table(tableName)}
          `;
          const [row] = await this.runQuery<BigQueryRow>(query, {});
          return {
            table: tableName,
            max_date: asNullableString(row?.max_date),
            available: true
          };
        } catch (error) {
          if (isNotFoundError(error)) {
            return {
              table: tableName,
              max_date: null,
              available: false
            };
          }

          throw error;
        }
      })
    );

    freshnessCache.set(cacheKey, {
      expiresAt: now + FRESHNESS_CACHE_TTL_MS,
      rows
    });

    return rows;
  }

  private async fetchAlerts(filters: AdminAnalyticsFilters): Promise<OverviewAlertResult> {
    const table = this.table("alert_events");
    const baseParams: Record<string, unknown> = {
      start_date: filters.start,
      end_date: filters.end
    };
    const tenantCondition = filters.tenant_id
      ? "AND tenant_id = @tenant_id"
      : "";

    if (filters.tenant_id) {
      baseParams.tenant_id = filters.tenant_id;
    }

    const query = `
      SELECT
        detected_at_utc,
        alert_name,
        severity,
        tenant_id,
        CAST(metric_value AS FLOAT64) AS metric_value,
        CAST(threshold_value AS FLOAT64) AS threshold_value
      FROM ${table}
      WHERE DATE(detected_at_utc) BETWEEN DATE(@start_date) AND DATE(@end_date)
      ${tenantCondition}
      ORDER BY detected_at_utc DESC
      LIMIT ${ALERTS_LIMIT}
    `;

    try {
      const rows = await this.runQuery<BigQueryRow>(query, baseParams);
      return {
        available: true,
        rows: rows.map((row) => ({
          detected_at_utc: asIsoTimestamp(row.detected_at_utc),
          alert_name: asNullableString(row.alert_name) ?? "",
          severity: asNullableString(row.severity) ?? "warn",
          tenant_id: asNullableString(row.tenant_id),
          metric_value: row.metric_value === null || row.metric_value === undefined
            ? null
            : asNumber(row.metric_value),
          threshold_value: row.threshold_value === null || row.threshold_value === undefined
            ? null
            : asNumber(row.threshold_value)
        }))
      };
    } catch (error) {
      if (isNotFoundError(error)) {
        return {
          available: false,
          rows: []
        };
      }

      throw error;
    }
  }

  async getOverview(filters: AdminAnalyticsFilters): Promise<AdminAnalyticsOverviewResponse> {
    const [
      aggregate,
      visitsTimeseries,
      revenueTimeseries,
      topTests,
      topTenants,
      freshnessRows,
      alerts
    ] = await Promise.all([
      this.fetchOverviewAggregate(filters),
      this.fetchVisitsTimeseries(filters),
      this.fetchRevenueTimeseries(filters),
      this.fetchTopTests(filters),
      this.fetchTopTenants(filters),
      this.fetchFreshnessRows(),
      this.fetchAlerts(filters)
    ]);

    return {
      filters,
      generated_at_utc: new Date().toISOString(),
      kpis: buildOverviewKpis(aggregate),
      funnel: buildOverviewFunnel(aggregate),
      visits_timeseries: visitsTimeseries,
      revenue_timeseries: revenueTimeseries,
      top_tests: topTests,
      top_tenants: topTenants,
      data_freshness: freshnessRows,
      alerts_available: alerts.available,
      alerts: alerts.rows
    };
  }

  async getTests(filters: AdminAnalyticsFilters): Promise<AdminAnalyticsTestsResponse> {
    const rows = await this.fetchTestsRows(filters);

    return {
      filters,
      generated_at_utc: new Date().toISOString(),
      rows
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

    const [aggregate, timeseries, tenantBreakdown, localeBreakdown, paywallMetrics] = await Promise.all([
      this.fetchOverviewAggregate(scopedFilters),
      this.fetchTestTimeseries(scopedFilters),
      this.fetchTestTenantBreakdown(scopedFilters),
      this.fetchTestLocaleBreakdown(scopedFilters),
      this.fetchTestPaywallMetrics(scopedFilters)
    ]);

    return {
      filters: scopedFilters,
      generated_at_utc: new Date().toISOString(),
      test_id: testId,
      kpis: buildOverviewKpis(aggregate),
      funnel: buildOverviewFunnel(aggregate),
      timeseries,
      tenant_breakdown: tenantBreakdown,
      locale_breakdown: localeBreakdown,
      paywall_metrics_available: paywallMetrics.available,
      paywall_metrics: paywallMetrics.metrics
    };
  }

  async getTenants(filters: AdminAnalyticsFilters): Promise<AdminAnalyticsTenantsResponse> {
    const tenants = await this.fetchTenantsRows(filters);

    return {
      filters,
      generated_at_utc: new Date().toISOString(),
      rows: tenants.rows,
      total_rows: tenants.totalRows
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

    const [aggregate, sessionsTimeseries, revenueTimeseries, topTests, localeBreakdown] = await Promise.all([
      this.fetchOverviewAggregate(scopedFilters),
      this.fetchVisitsTimeseries(scopedFilters),
      this.fetchRevenueTimeseries(scopedFilters),
      this.fetchTenantTopTests(scopedFilters),
      this.fetchTenantLocaleBreakdown(scopedFilters)
    ]);

    const hasData =
      sessionsTimeseries.length > 0 ||
      revenueTimeseries.length > 0 ||
      topTests.totalRows > 0 ||
      localeBreakdown.totalRows > 0;

    return {
      filters: scopedFilters,
      generated_at_utc: new Date().toISOString(),
      tenant_id: tenantId,
      kpis: hasData ? buildOverviewKpis(aggregate) : [],
      funnel: hasData ? buildOverviewFunnel(aggregate) : [],
      sessions_timeseries: sessionsTimeseries,
      revenue_timeseries: revenueTimeseries,
      top_tests: topTests.rows,
      top_tests_total: topTests.totalRows,
      locale_breakdown: localeBreakdown.rows,
      locale_breakdown_total: localeBreakdown.totalRows,
      has_data: hasData
    };
  }

  async getDistribution(
    filters: AdminAnalyticsFilters,
    options: AdminAnalyticsDistributionOptions
  ): Promise<AdminAnalyticsDistributionResponse> {
    const resolvedOptions = resolveAdminAnalyticsDistributionOptions(options);
    const [topTenants, topTests] = await Promise.all([
      this.fetchDistributionTopTenants(filters, resolvedOptions.top_tenants),
      this.fetchDistributionTopTests(filters, resolvedOptions.top_tests)
    ]);

    const rowOrder = topTenants.map((row) => row.tenant_id);
    const columnOrder = topTests.map((row) => row.test_id);
    const [metricsByCell, publicationByCell] = await Promise.all([
      this.fetchDistributionMetrics(filters, rowOrder, columnOrder),
      this.fetchDistributionPublicationState(rowOrder, columnOrder)
    ]);

    const columns: Record<string, AdminAnalyticsDistributionColumn> = {};
    for (const column of topTests) {
      columns[column.test_id] = {
        test_id: column.test_id,
        net_revenue_eur_7d: column.net_revenue_eur_7d
      };
    }

    const rows: AdminAnalyticsDistributionResponse["rows"] = {};
    for (const tenant of topTenants) {
      const cells: Record<string, AdminAnalyticsDistributionCell> = {};

      for (const testId of columnOrder) {
        const cellKey = distributionCellKey(tenant.tenant_id, testId);
        const metrics = metricsByCell.get(cellKey);
        const publication = publicationByCell.get(cellKey);

        cells[testId] = {
          tenant_id: tenant.tenant_id,
          test_id: testId,
          is_published: publication?.is_published ?? false,
          version_id: publication?.version_id ?? null,
          enabled: publication?.enabled ?? null,
          net_revenue_eur_7d: metrics?.net_revenue_eur_7d ?? 0,
          paid_conversion_7d: metrics?.paid_conversion_7d ?? 0
        };
      }

      rows[tenant.tenant_id] = {
        tenant_id: tenant.tenant_id,
        net_revenue_eur_7d: tenant.net_revenue_eur_7d,
        cells
      };
    }

    return {
      filters,
      generated_at_utc: new Date().toISOString(),
      top_tenants: resolvedOptions.top_tenants,
      top_tests: resolvedOptions.top_tests,
      row_order: rowOrder,
      column_order: columnOrder,
      rows,
      columns
    };
  }

  async getTraffic(
    filters: AdminAnalyticsFilters,
    options?: AdminAnalyticsTrafficOptions
  ): Promise<AdminAnalyticsTrafficResponse> {
    const resolvedOptions = resolveAdminAnalyticsTrafficOptions(options);
    const topN = resolvedOptions.top_n;
    const [
      aggregate,
      byUtmSource,
      byUtmCampaign,
      byReferrer,
      byDeviceType,
      byCountry
    ] = await Promise.all([
      this.fetchOverviewAggregate(filters),
      this.fetchTrafficChannelBreakdown(filters, "utm_source", topN),
      this.fetchTrafficChannelBreakdown(filters, "utm_campaign", topN),
      this.fetchTrafficFunnelDimensionBreakdown(filters, "referrer", topN),
      this.fetchTrafficFunnelDimensionBreakdown(filters, "device_type", topN),
      this.fetchTrafficFunnelDimensionBreakdown(filters, "country", topN)
    ]);

    return {
      filters,
      generated_at_utc: new Date().toISOString(),
      top_n: topN,
      kpis: buildOverviewKpis(aggregate),
      by_utm_source: byUtmSource,
      by_utm_campaign: byUtmCampaign,
      by_referrer: byReferrer,
      by_device_type: byDeviceType,
      by_country: byCountry
    };
  }

  async getRevenue(filters: AdminAnalyticsFilters): Promise<AdminAnalyticsRevenueResponse> {
    void filters;
    throw this.notImplemented("getRevenue");
  }

  async getDataHealth(filters: AdminAnalyticsFilters): Promise<AdminAnalyticsDataResponse> {
    void filters;
    throw this.notImplemented("getDataHealth");
  }
}

const readRequiredEnv = (name: string): string => {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env var ${name}.`);
  }

  return value.trim();
};

export const __resetBigQueryProviderCachesForTests = (): void => {
  freshnessCache.clear();
};

export const createBigQueryAdminAnalyticsProvider = (): AdminAnalyticsProvider => {
  const projectId = readRequiredEnv("BIGQUERY_PROJECT_ID");
  const datasets: BigQueryAdminAnalyticsDatasets = {
    stripe: readRequiredEnv("BIGQUERY_STRIPE_DATASET"),
    rawCosts: readRequiredEnv("BIGQUERY_RAW_COSTS_DATASET"),
    tmp: readRequiredEnv("BIGQUERY_TMP_DATASET"),
    marts: DEFAULT_MARTS_DATASET
  };
  const bigquery = new BigQuery({ projectId });
  return new BigQueryAdminAnalyticsProvider(bigquery, projectId, datasets);
};

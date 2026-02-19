import { BigQuery } from "@google-cloud/bigquery";
import { env } from "@/lib/env";

import { resolveAdminAnalyticsProviderMode } from "../admin_analytics/provider";
import { getContentDbPool } from "../content_db/pool";

import type { AlertRuleScope } from "./types";

export type AlertDailyMetricsPoint = {
  date: string;
  visits: number;
  purchases: number;
  gross_revenue_eur: number;
  refunds_eur: number;
  net_revenue_eur: number;
};

export type AlertFreshnessSnapshot = {
  analytics_last_event_at: string | null;
  revenue_last_event_at: string | null;
};

export type AlertMetricsWindowInput = {
  scope: AlertRuleScope;
  start_date: string;
  end_date: string;
};

export interface AlertsProvider {
  getDailyMetrics(input: AlertMetricsWindowInput): Promise<AlertDailyMetricsPoint[]>;
  getFreshnessSnapshot(scope: AlertRuleScope): Promise<AlertFreshnessSnapshot>;
}

export type AlertsProviderMode = "mock" | "bigquery" | "content_db";

type DailyMetricsRow = {
  date: unknown;
  visits: unknown;
  purchases: unknown;
  gross_revenue_eur: unknown;
  refunds_eur: unknown;
  net_revenue_eur: unknown;
};

type FreshnessRow = {
  last_loaded_at: unknown;
};

type BigQueryDatasets = {
  stripe: string;
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

type BigQueryClientLike = {
  createQueryJob(options: BigQueryQueryOptions): Promise<[BigQueryQueryJobLike, ...unknown[]]>;
};

let cachedProvider: AlertsProvider | null = null;
let cachedMode: AlertsProviderMode | null = null;

const normalizeNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toNumber = (value: unknown): number => {
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
    return toNumber((value as { value: unknown }).value);
  }

  return 0;
};

const toNullableString = (value: unknown): string | null => {
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
    return toNullableString((value as { value: unknown }).value);
  }

  return String(value);
};

const toIsoString = (value: unknown): string | null => {
  const normalized = toNullableString(value);
  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return normalized;
  }

  return parsed.toISOString();
};

const toDateString = (value: unknown): string | null => {
  const normalized = toNullableString(value);
  if (!normalized) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
};

const normalizeScope = (scope: AlertRuleScope): AlertRuleScope => {
  const tenantId = normalizeNonEmptyString(scope.tenant_id);
  const contentType = normalizeNonEmptyString(scope.content_type)?.toLowerCase() ?? null;
  const contentKey = normalizeNonEmptyString(scope.content_key);

  return {
    tenant_id: tenantId,
    content_type: contentType,
    content_key: contentKey
  };
};

const resolveScopedTestId = (scope: AlertRuleScope): string | null => {
  if (scope.content_type && scope.content_type !== "test") {
    return null;
  }

  if (scope.content_type === "test") {
    return scope.content_key;
  }

  return scope.content_key;
};

const isUnsupportedScope = (scope: AlertRuleScope): boolean => {
  return Boolean(scope.content_type && scope.content_type !== "test");
};

const mapDailyMetricsRow = (row: DailyMetricsRow): AlertDailyMetricsPoint | null => {
  const date = toDateString(row.date);
  if (!date) {
    return null;
  }

  return {
    date,
    visits: toNumber(row.visits),
    purchases: toNumber(row.purchases),
    gross_revenue_eur: toNumber(row.gross_revenue_eur),
    refunds_eur: toNumber(row.refunds_eur),
    net_revenue_eur: toNumber(row.net_revenue_eur)
  };
};

class MockAlertsProvider implements AlertsProvider {
  async getDailyMetrics(): Promise<AlertDailyMetricsPoint[]> {
    return [];
  }

  async getFreshnessSnapshot(): Promise<AlertFreshnessSnapshot> {
    return {
      analytics_last_event_at: null,
      revenue_last_event_at: null
    };
  }
}

class ContentDbAlertsProvider implements AlertsProvider {
  async getDailyMetrics(input: AlertMetricsWindowInput): Promise<AlertDailyMetricsPoint[]> {
    const scope = normalizeScope(input.scope);
    if (isUnsupportedScope(scope)) {
      return [];
    }

    const testId = resolveScopedTestId(scope);
    const params: unknown[] = [input.start_date, input.end_date];
    const eventFilters: string[] = [
      "ae.occurred_date >= $1::date",
      "ae.occurred_date <= $2::date"
    ];
    const purchaseScopeFilters: string[] = [];

    if (scope.tenant_id) {
      params.push(scope.tenant_id);
      const index = params.length;
      eventFilters.push(`ae.tenant_id = $${index}`);
      purchaseScopeFilters.push(`sp.tenant_id = $${index}`);
    }

    if (testId) {
      params.push(testId);
      const index = params.length;
      eventFilters.push(`ae.test_id = $${index}`);
      purchaseScopeFilters.push(`sp.test_id = $${index}`);
    }

    const purchaseScopeWhere =
      purchaseScopeFilters.length > 0
        ? `WHERE ${purchaseScopeFilters.join(" AND ")}`
        : "";

    const pool = getContentDbPool();
    const { rows } = await pool.query<DailyMetricsRow>(
      `
        WITH day_series AS (
          SELECT generate_series($1::date, $2::date, interval '1 day')::date AS date
        ),
        events AS (
          SELECT
            ae.occurred_date AS date,
            COUNT(DISTINCT ae.session_id) FILTER (WHERE ae.event_name = 'page_view')::double precision AS visits
          FROM analytics_events ae
          WHERE ${eventFilters.join(" AND ")}
          GROUP BY ae.occurred_date
        ),
        purchase_dim AS (
          SELECT
            sp.purchase_id,
            sp.created_utc::date AS date,
            COALESCE(sp.amount_eur, 0)::double precision AS amount_eur
          FROM stripe_purchases sp
          ${purchaseScopeWhere}
        ),
        purchases AS (
          SELECT
            pd.date,
            COUNT(DISTINCT pd.purchase_id)::double precision AS purchases,
            COALESCE(SUM(pd.amount_eur), 0)::double precision AS gross_revenue_eur
          FROM purchase_dim pd
          WHERE pd.date >= $1::date
            AND pd.date <= $2::date
          GROUP BY pd.date
        ),
        refunds AS (
          SELECT
            r.created_utc::date AS date,
            COALESCE(SUM(COALESCE(r.amount_eur, 0)::double precision), 0)::double precision AS refunds_eur
          FROM stripe_refunds r
          JOIN purchase_dim pd
            ON pd.purchase_id = r.purchase_id
          WHERE r.created_utc::date >= $1::date
            AND r.created_utc::date <= $2::date
          GROUP BY r.created_utc::date
        ),
        disputes AS (
          SELECT
            d.created_utc::date AS date,
            COALESCE(SUM(COALESCE(d.amount_eur, 0)::double precision), 0)::double precision AS disputes_eur
          FROM stripe_disputes d
          JOIN purchase_dim pd
            ON pd.purchase_id = d.purchase_id
          WHERE d.created_utc::date >= $1::date
            AND d.created_utc::date <= $2::date
          GROUP BY d.created_utc::date
        ),
        fees AS (
          SELECT
            f.created_utc::date AS date,
            COALESCE(SUM(COALESCE(f.fee_eur, 0)::double precision), 0)::double precision AS payment_fees_eur
          FROM stripe_fees f
          JOIN purchase_dim pd
            ON pd.purchase_id = f.purchase_id
          WHERE f.created_utc::date >= $1::date
            AND f.created_utc::date <= $2::date
          GROUP BY f.created_utc::date
        )
        SELECT
          ds.date::text AS date,
          COALESCE(e.visits, 0)::double precision AS visits,
          COALESCE(p.purchases, 0)::double precision AS purchases,
          COALESCE(p.gross_revenue_eur, 0)::double precision AS gross_revenue_eur,
          COALESCE(r.refunds_eur, 0)::double precision AS refunds_eur,
          (
            COALESCE(p.gross_revenue_eur, 0)
              - COALESCE(r.refunds_eur, 0)
              - COALESCE(d.disputes_eur, 0)
              - COALESCE(f.payment_fees_eur, 0)
          )::double precision AS net_revenue_eur
        FROM day_series ds
        LEFT JOIN events e
          ON e.date = ds.date
        LEFT JOIN purchases p
          ON p.date = ds.date
        LEFT JOIN refunds r
          ON r.date = ds.date
        LEFT JOIN disputes d
          ON d.date = ds.date
        LEFT JOIN fees f
          ON f.date = ds.date
        ORDER BY ds.date ASC
      `,
      params
    );

    return rows
      .map((row) => mapDailyMetricsRow(row))
      .filter((row): row is AlertDailyMetricsPoint => row !== null);
  }

  async getFreshnessSnapshot(scopeInput: AlertRuleScope): Promise<AlertFreshnessSnapshot> {
    const scope = normalizeScope(scopeInput);
    if (isUnsupportedScope(scope)) {
      return {
        analytics_last_event_at: null,
        revenue_last_event_at: null
      };
    }

    const testId = resolveScopedTestId(scope);
    const eventParams: unknown[] = [];
    const eventFilters: string[] = [];
    const purchaseParams: unknown[] = [];
    const purchaseFilters: string[] = [];

    if (scope.tenant_id) {
      eventParams.push(scope.tenant_id);
      eventFilters.push(`ae.tenant_id = $${eventParams.length}`);

      purchaseParams.push(scope.tenant_id);
      purchaseFilters.push(`sp.tenant_id = $${purchaseParams.length}`);
    }

    if (testId) {
      eventParams.push(testId);
      eventFilters.push(`ae.test_id = $${eventParams.length}`);

      purchaseParams.push(testId);
      purchaseFilters.push(`sp.test_id = $${purchaseParams.length}`);
    }

    const eventWhere = eventFilters.length > 0 ? `WHERE ${eventFilters.join(" AND ")}` : "";
    const purchaseWhere =
      purchaseFilters.length > 0 ? `WHERE ${purchaseFilters.join(" AND ")}` : "";

    const pool = getContentDbPool();
    const [analyticsResult, revenueResult] = await Promise.all([
      pool.query<FreshnessRow>(
        `
          SELECT MAX(ae.occurred_at) AS last_loaded_at
          FROM analytics_events ae
          ${eventWhere}
        `,
        eventParams
      ),
      pool.query<FreshnessRow>(
        `
          SELECT MAX(sp.created_utc) AS last_loaded_at
          FROM stripe_purchases sp
          ${purchaseWhere}
        `,
        purchaseParams
      )
    ]);

    return {
      analytics_last_event_at: toIsoString(analyticsResult.rows[0]?.last_loaded_at),
      revenue_last_event_at: toIsoString(revenueResult.rows[0]?.last_loaded_at)
    };
  }
}

const isNotFoundError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; message?: unknown };
  if (typeof candidate.code === "number" && candidate.code === 404) {
    return true;
  }

  const message = typeof candidate.message === "string" ? candidate.message.toLowerCase() : "";
  return message.includes("not found");
};

class BigQueryAlertsProvider implements AlertsProvider {
  private readonly bigquery: BigQueryClientLike;
  private readonly projectId: string;
  private readonly datasets: BigQueryDatasets;

  constructor(bigquery: BigQueryClientLike, projectId: string, datasets: BigQueryDatasets) {
    this.bigquery = bigquery;
    this.projectId = projectId;
    this.datasets = datasets;
  }

  private table(dataset: string, tableName: string): string {
    return `\`${this.projectId}.${dataset}.${tableName}\``;
  }

  private async runQuery<T extends Record<string, unknown>>(
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

  async getDailyMetrics(input: AlertMetricsWindowInput): Promise<AlertDailyMetricsPoint[]> {
    const scope = normalizeScope(input.scope);
    if (isUnsupportedScope(scope)) {
      return [];
    }

    const testId = resolveScopedTestId(scope);
    const funnelTable = this.table(this.datasets.marts, "mart_funnel_daily");
    const pnlTable = this.table(this.datasets.marts, "mart_pnl_daily");

    const params: Record<string, unknown> = {
      start_date: input.start_date,
      end_date: input.end_date
    };

    const funnelFilters = ["date >= @start_date", "date <= @end_date"];
    const pnlFilters = ["date >= @start_date", "date <= @end_date"];

    if (scope.tenant_id) {
      params.tenant_id = scope.tenant_id;
      funnelFilters.push("tenant_id = @tenant_id");
      pnlFilters.push("tenant_id = @tenant_id");
    }

    if (testId) {
      params.test_id = testId;
      funnelFilters.push("test_id = @test_id");
      pnlFilters.push("test_id = @test_id");
    }

    const query = `
      WITH days AS (
        SELECT day AS date
        FROM UNNEST(GENERATE_DATE_ARRAY(@start_date, @end_date)) AS day
      ),
      funnel AS (
        SELECT
          date,
          SUM(COALESCE(visits, 0)) AS visits,
          SUM(COALESCE(purchases, 0)) AS purchases
        FROM ${funnelTable}
        WHERE ${funnelFilters.join(" AND ")}
        GROUP BY date
      ),
      pnl AS (
        SELECT
          date,
          SUM(COALESCE(gross_revenue_eur, 0)) AS gross_revenue_eur,
          SUM(COALESCE(refunds_eur, 0)) AS refunds_eur,
          SUM(COALESCE(net_revenue_eur, 0)) AS net_revenue_eur
        FROM ${pnlTable}
        WHERE ${pnlFilters.join(" AND ")}
        GROUP BY date
      )
      SELECT
        CAST(days.date AS STRING) AS date,
        COALESCE(funnel.visits, 0) AS visits,
        COALESCE(funnel.purchases, 0) AS purchases,
        COALESCE(pnl.gross_revenue_eur, 0) AS gross_revenue_eur,
        COALESCE(pnl.refunds_eur, 0) AS refunds_eur,
        COALESCE(pnl.net_revenue_eur, 0) AS net_revenue_eur
      FROM days
      LEFT JOIN funnel
        ON funnel.date = days.date
      LEFT JOIN pnl
        ON pnl.date = days.date
      ORDER BY days.date ASC
    `;

    const rows = await this.runQuery<DailyMetricsRow>(query, params);
    return rows
      .map((row) => mapDailyMetricsRow(row))
      .filter((row): row is AlertDailyMetricsPoint => row !== null);
  }

  async getFreshnessSnapshot(scopeInput: AlertRuleScope): Promise<AlertFreshnessSnapshot> {
    const scope = normalizeScope(scopeInput);
    if (isUnsupportedScope(scope)) {
      return {
        analytics_last_event_at: null,
        revenue_last_event_at: null
      };
    }

    const testId = resolveScopedTestId(scope);
    const funnelTable = this.table(this.datasets.marts, "mart_funnel_daily");
    const stripeTable = this.table(this.datasets.stripe, "purchases");

    const funnelParams: Record<string, unknown> = {};
    const funnelFilters: string[] = [];

    if (scope.tenant_id) {
      funnelParams.tenant_id = scope.tenant_id;
      funnelFilters.push("tenant_id = @tenant_id");
    }

    if (testId) {
      funnelParams.test_id = testId;
      funnelFilters.push("test_id = @test_id");
    }

    const stripeParams: Record<string, unknown> = {};
    const stripeFilters: string[] = [];

    if (scope.tenant_id) {
      stripeParams.tenant_id = scope.tenant_id;
      stripeFilters.push("tenant_id = @tenant_id");
    }

    if (testId) {
      stripeParams.test_id = testId;
      stripeFilters.push("test_id = @test_id");
    }

    const funnelWhere = funnelFilters.length > 0 ? `WHERE ${funnelFilters.join(" AND ")}` : "";
    const stripeWhere = stripeFilters.length > 0 ? `WHERE ${stripeFilters.join(" AND ")}` : "";

    const funnelQuery = `
      SELECT MAX(TIMESTAMP(date)) AS last_loaded_at
      FROM ${funnelTable}
      ${funnelWhere}
    `;

    const stripeQuery = `
      SELECT MAX(created_utc) AS last_loaded_at
      FROM ${stripeTable}
      ${stripeWhere}
    `;

    let analyticsLastEventAt: string | null = null;
    let revenueLastEventAt: string | null = null;

    try {
      const rows = await this.runQuery<FreshnessRow>(funnelQuery, funnelParams);
      analyticsLastEventAt = toIsoString(rows[0]?.last_loaded_at);
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
    }

    try {
      const rows = await this.runQuery<FreshnessRow>(stripeQuery, stripeParams);
      revenueLastEventAt = toIsoString(rows[0]?.last_loaded_at);
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
    }

    return {
      analytics_last_event_at: analyticsLastEventAt,
      revenue_last_event_at: revenueLastEventAt
    };
  }
}

const readRequiredEnv = (
  name: "BIGQUERY_PROJECT_ID" | "BIGQUERY_STRIPE_DATASET"
): string => {
  const value = normalizeNonEmptyString(env[name]);
  if (!value) {
    throw new Error(`Missing required env var ${name}.`);
  }

  return value;
};

const createBigQueryAlertsProvider = (): AlertsProvider => {
  const projectId = readRequiredEnv("BIGQUERY_PROJECT_ID");
  const datasets: BigQueryDatasets = {
    stripe: readRequiredEnv("BIGQUERY_STRIPE_DATASET"),
    marts: "marts"
  };

  return new BigQueryAlertsProvider(new BigQuery({ projectId }), projectId, datasets);
};

export const resolveAlertsProviderMode = (): AlertsProviderMode => {
  return resolveAdminAnalyticsProviderMode();
};

export const getAlertsProvider = (): AlertsProvider => {
  const mode = resolveAlertsProviderMode();
  if (cachedProvider && cachedMode === mode) {
    return cachedProvider;
  }

  switch (mode) {
    case "content_db":
      cachedProvider = new ContentDbAlertsProvider();
      break;
    case "bigquery":
      cachedProvider = createBigQueryAlertsProvider();
      break;
    case "mock":
    default:
      cachedProvider = new MockAlertsProvider();
      break;
  }

  cachedMode = mode;
  return cachedProvider;
};

export const __resetAlertsProviderForTests = (): void => {
  cachedProvider = null;
  cachedMode = null;
};

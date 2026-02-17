import { parseDateYYYYMMDD } from "../../admin/analytics_dates";
import { getContentDbPool } from "../../content_db/pool";
import {
  combineHealthStatus,
  evaluateFreshnessStatus,
  resolveFreshnessThresholds
} from "../data_health";
import type { AdminAnalyticsProvider } from "../provider";
import {
  resolveAdminAnalyticsDistributionOptions,
  resolveAdminAnalyticsTrafficOptions,
  type AdminAnalyticsAttributionGroupBy,
  type AdminAnalyticsAttributionMixRow,
  type AdminAnalyticsAttributionOptions,
  type AdminAnalyticsAttributionResponse,
  type AdminAnalyticsAttributionRow,
  type AdminAnalyticsDataAlertRow,
  type AdminAnalyticsDataDbtRunMarker,
  type AdminAnalyticsDataFreshnessRow,
  type AdminAnalyticsDataHealthCheck,
  type AdminAnalyticsDataHealthStatus,
  type AdminAnalyticsDataResponse,
  type AdminAnalyticsDistributionCell,
  type AdminAnalyticsDistributionColumn,
  type AdminAnalyticsDistributionOptions,
  type AdminAnalyticsDistributionResponse,
  type AdminAnalyticsFilters,
  type AdminAnalyticsOverviewFreshnessRow,
  type AdminAnalyticsOverviewResponse,
  type AdminAnalyticsRevenueByOfferRow,
  type AdminAnalyticsRevenueByTenantRow,
  type AdminAnalyticsRevenueByTestRow,
  type AdminAnalyticsRevenueDailyRow,
  type AdminAnalyticsRevenueReconciliation,
  type AdminAnalyticsRevenueResponse,
  type AdminAnalyticsTenantDetailResponse,
  type AdminAnalyticsTenantLocaleRow,
  type AdminAnalyticsTenantTopTestRow,
  type AdminAnalyticsTenantsResponse,
  type AdminAnalyticsTenantsRow,
  type AdminAnalyticsTestDetailResponse,
  type AdminAnalyticsTestLocaleRow,
  type AdminAnalyticsTestTenantRow,
  type AdminAnalyticsTestTimeseriesRow,
  type AdminAnalyticsTestsResponse,
  type AdminAnalyticsTestsRow,
  type AdminAnalyticsTrafficOptions,
  type AdminAnalyticsTrafficResponse,
  type AdminAnalyticsTrafficSegmentRow,
  type FunnelStep,
  type KpiCard,
  type TimeseriesPoint
} from "../types";

type ContentDbClient = {
  query: (
    text: string,
    values?: unknown[]
  ) => Promise<{ rows: Array<Record<string, unknown>>; rowCount: number | null }>;
};

type ContentDbTableAvailability = {
  analytics_events: boolean;
  stripe_purchases: boolean;
  stripe_refunds: boolean;
  stripe_disputes: boolean;
  stripe_fees: boolean;
  tests: boolean;
  tenant_tests: boolean;
};

type OverviewAggregate = {
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

type EventDimensionMetrics = {
  sessions: number;
  starts: number;
  completes: number;
  paywall_views: number;
  checkout_starts: number;
  last_activity_date: string | null;
};

type StripeDimensionMetrics = {
  purchases: number;
  gross_revenue_eur: number;
  refunds_eur: number;
  disputes_eur: number;
  payment_fees_eur: number;
  net_revenue_eur: number;
  last_activity_date: string | null;
};

type SqlFilterClause = {
  whereSql: string;
  params: unknown[];
};

type EventFilterOptions = {
  alias?: string;
  includeTestFilter?: boolean;
};

type StripeFilterOptions = {
  alias?: string;
  includeTestFilter?: boolean;
  canFilterByDeviceType?: boolean;
};

type TrafficDimension = "utm_source" | "utm_campaign" | "referrer" | "device_type" | "country";

type StripeCteBuild = {
  cteSql: string;
  params: unknown[];
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const OVERVIEW_TOP_ROWS_LIMIT = 10;
const TENANTS_ROWS_LIMIT = 50;
const TESTS_ROWS_LIMIT = 100;
const DETAIL_ROWS_LIMIT = 100;

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

const toDateOnlyString = (value: unknown): string | null => {
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

const roundCurrency = (value: number): number => {
  return Math.round(value * 100) / 100;
};

export const safeRatio = (numerator: number, denominator: number): number => {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }

  return Math.round((numerator / denominator) * 10_000) / 10_000;
};

const maxDate = (left: string | null, right: string | null): string | null => {
  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  return left >= right ? left : right;
};

const generatedAtUtc = (): string => new Date().toISOString();

const listDatesInclusive = (start: string, end: string): string[] => {
  const parsedStart = parseDateYYYYMMDD(start);
  const parsedEnd = parseDateYYYYMMDD(end);
  if (!parsedStart || !parsedEnd || parsedStart.getTime() > parsedEnd.getTime()) {
    return [end];
  }

  const rows: string[] = [];
  for (let current = parsedStart.getTime(); current <= parsedEnd.getTime(); current += DAY_IN_MS) {
    rows.push(new Date(current).toISOString().slice(0, 10));
  }

  return rows;
};

const normalizeTrafficSegment = (value: unknown, fallback: "(none)" | "(unknown)"): string => {
  const normalized = toNullableString(value)?.trim();
  if (!normalized) {
    return fallback;
  }

  return normalized;
};

const resolveOfferType = (offerKey: string | null, productType: string | null): "single" | "pack_5" | "pack_10" | "unknown" => {
  const haystack = `${offerKey ?? ""} ${productType ?? ""}`.toLowerCase();

  if (haystack.includes("pack_10") || haystack.includes("pack-10") || haystack.includes("10")) {
    return "pack_10";
  }

  if (haystack.includes("pack_5") || haystack.includes("pack-5") || haystack.includes("5")) {
    return "pack_5";
  }

  if (haystack.includes("single") || haystack.includes("one")) {
    return "single";
  }

  return "unknown";
};

export const buildContentDbEventFilterClause = (
  filters: AdminAnalyticsFilters,
  options: EventFilterOptions = {}
): SqlFilterClause => {
  const alias = options.alias ?? "ae";
  const includeTestFilter = options.includeTestFilter ?? true;

  const params: unknown[] = [filters.start, filters.end];
  const conditions: string[] = [
    `${alias}.occurred_date >= $1::date`,
    `${alias}.occurred_date <= $2::date`
  ];

  if (filters.tenant_id) {
    params.push(filters.tenant_id);
    conditions.push(`${alias}.tenant_id = $${params.length}`);
  }

  if (includeTestFilter && filters.test_id) {
    params.push(filters.test_id);
    conditions.push(`${alias}.test_id = $${params.length}`);
  }

  if (filters.locale !== "all") {
    params.push(filters.locale);
    conditions.push(`${alias}.locale = $${params.length}`);
  }

  if (filters.device_type !== "all") {
    params.push(filters.device_type);
    conditions.push(`${alias}.device_type = $${params.length}`);
  }

  if (filters.utm_source) {
    params.push(filters.utm_source);
    conditions.push(`${alias}.utm_source = $${params.length}`);
  }

  return {
    whereSql: `WHERE ${conditions.join(" AND ")}`,
    params
  };
};

export const buildContentDbStripeFilterClause = (
  filters: AdminAnalyticsFilters,
  options: StripeFilterOptions = {}
): SqlFilterClause => {
  const alias = options.alias ?? "sp";
  const includeTestFilter = options.includeTestFilter ?? true;
  const canFilterByDeviceType = options.canFilterByDeviceType ?? true;

  const params: unknown[] = [filters.start, filters.end];
  const conditions: string[] = [
    `${alias}.created_utc::date >= $1::date`,
    `${alias}.created_utc::date <= $2::date`
  ];

  if (filters.tenant_id) {
    params.push(filters.tenant_id);
    conditions.push(`${alias}.tenant_id = $${params.length}`);
  }

  if (includeTestFilter && filters.test_id) {
    params.push(filters.test_id);
    conditions.push(`${alias}.test_id = $${params.length}`);
  }

  if (filters.locale !== "all") {
    params.push(filters.locale);
    conditions.push(`${alias}.locale = $${params.length}`);
  }

  if (filters.utm_source) {
    params.push(filters.utm_source);
    conditions.push(`${alias}.utm_source = $${params.length}`);
  }

  if (filters.device_type !== "all") {
    if (!canFilterByDeviceType) {
      conditions.push("1 = 0");
    } else {
      params.push(filters.device_type);
      conditions.push(
        `EXISTS (\n` +
          `  SELECT 1\n` +
          `  FROM analytics_events ae_device\n` +
          `  WHERE ae_device.session_id = ${alias}.session_id\n` +
          `    AND ae_device.occurred_date >= $1::date\n` +
          `    AND ae_device.occurred_date <= $2::date\n` +
          `    AND ae_device.device_type = $${params.length}\n` +
          `)`
      );
    }
  }

  return {
    whereSql: `WHERE ${conditions.join(" AND ")}`,
    params
  };
};

const buildOverviewKpis = (aggregate: OverviewAggregate): KpiCard[] => {
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

const buildOverviewFunnel = (aggregate: OverviewAggregate): FunnelStep[] => {
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

const normalizeAttributionOption = (value: string | null): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const buildAttributionMixRows = (
  rows: AdminAnalyticsAttributionRow[],
  groupedBy: AdminAnalyticsAttributionGroupBy
): AdminAnalyticsAttributionMixRow[] => {
  const bySegment = new Map<string, AdminAnalyticsAttributionMixRow>();

  for (const row of rows) {
    const segment = groupedBy === "tenant" ? row.tenant_id : row.content_key;
    const current = bySegment.get(segment) ?? {
      segment,
      gross_revenue_eur: 0,
      refunds_eur: 0,
      disputes_fees_eur: 0,
      payment_fees_eur: 0,
      net_revenue_eur: 0
    };

    current.gross_revenue_eur = roundCurrency(current.gross_revenue_eur + row.gross_revenue_eur);
    current.refunds_eur = roundCurrency(current.refunds_eur + row.refunds_eur);
    current.disputes_fees_eur = roundCurrency(current.disputes_fees_eur + row.disputes_fees_eur);
    current.payment_fees_eur = roundCurrency(current.payment_fees_eur + row.payment_fees_eur);
    current.net_revenue_eur = roundCurrency(current.net_revenue_eur + row.net_revenue_eur);
    bySegment.set(segment, current);
  }

  return [...bySegment.values()]
    .sort(
      (left, right) =>
        right.net_revenue_eur - left.net_revenue_eur ||
        left.segment.localeCompare(right.segment)
    )
    .slice(0, 20);
};

const emptyEventMetrics = (): EventDimensionMetrics => ({
  sessions: 0,
  starts: 0,
  completes: 0,
  paywall_views: 0,
  checkout_starts: 0,
  last_activity_date: null
});

const emptyStripeMetrics = (): StripeDimensionMetrics => ({
  purchases: 0,
  gross_revenue_eur: 0,
  refunds_eur: 0,
  disputes_eur: 0,
  payment_fees_eur: 0,
  net_revenue_eur: 0,
  last_activity_date: null
});

export class ContentDbAdminAnalyticsProvider implements AdminAnalyticsProvider {
  private tableAvailabilityPromise: Promise<ContentDbTableAvailability> | null = null;

  constructor(private readonly client: ContentDbClient = getContentDbPool()) {}

  private async queryRows<T extends Record<string, unknown>>(
    text: string,
    values: unknown[] = []
  ): Promise<T[]> {
    const result = await this.client.query(text, values);
    return result.rows as T[];
  }

  private async resolveTableAvailability(): Promise<ContentDbTableAvailability> {
    if (!this.tableAvailabilityPromise) {
      this.tableAvailabilityPromise = (async () => {
        const tableNames = [
          "analytics_events",
          "stripe_purchases",
          "stripe_refunds",
          "stripe_disputes",
          "stripe_fees",
          "tests",
          "tenant_tests"
        ];

        try {
          const rows = await this.queryRows<{ table_name: string }>(
            `
              SELECT table_name
              FROM information_schema.tables
              WHERE table_schema = 'public'
                AND table_name = ANY($1::text[])
            `,
            [tableNames]
          );

          const available = new Set(rows.map((row) => row.table_name));
          return {
            analytics_events: available.has("analytics_events"),
            stripe_purchases: available.has("stripe_purchases"),
            stripe_refunds: available.has("stripe_refunds"),
            stripe_disputes: available.has("stripe_disputes"),
            stripe_fees: available.has("stripe_fees"),
            tests: available.has("tests"),
            tenant_tests: available.has("tenant_tests")
          };
        } catch {
          return {
            analytics_events: false,
            stripe_purchases: false,
            stripe_refunds: false,
            stripe_disputes: false,
            stripe_fees: false,
            tests: false,
            tenant_tests: false
          };
        }
      })();
    }

    return this.tableAvailabilityPromise;
  }

  private buildStripeCte(filters: AdminAnalyticsFilters, tables: ContentDbTableAvailability): StripeCteBuild | null {
    if (!tables.stripe_purchases) {
      return null;
    }

    const stripeFilter = buildContentDbStripeFilterClause(filters, {
      alias: "sp",
      canFilterByDeviceType: tables.analytics_events
    });

    const feeByPurchaseCte = tables.stripe_fees
      ? `
        fee_by_purchase AS (
          SELECT
            purchase_id,
            SUM(COALESCE(fee_eur, 0))::numeric AS payment_fees_eur,
            SUM(COALESCE(net_eur, 0))::numeric AS net_after_fees_eur
          FROM stripe_fees
          GROUP BY purchase_id
        )
      `
      : `
        fee_by_purchase AS (
          SELECT
            NULL::text AS purchase_id,
            0::numeric AS payment_fees_eur,
            0::numeric AS net_after_fees_eur
          WHERE FALSE
        )
      `;

    const refundByPurchaseCte = tables.stripe_refunds
      ? `
        refund_by_purchase AS (
          SELECT
            purchase_id,
            SUM(COALESCE(amount_eur, 0))::numeric AS refunds_eur
          FROM stripe_refunds
          GROUP BY purchase_id
        )
      `
      : `
        refund_by_purchase AS (
          SELECT
            NULL::text AS purchase_id,
            0::numeric AS refunds_eur
          WHERE FALSE
        )
      `;

    const disputeByPurchaseCte = tables.stripe_disputes
      ? `
        dispute_by_purchase AS (
          SELECT
            purchase_id,
            SUM(COALESCE(amount_eur, 0))::numeric AS disputes_eur
          FROM stripe_disputes
          GROUP BY purchase_id
        )
      `
      : `
        dispute_by_purchase AS (
          SELECT
            NULL::text AS purchase_id,
            0::numeric AS disputes_eur
          WHERE FALSE
        )
      `;

    const cteSql = `
      ${feeByPurchaseCte},
      ${refundByPurchaseCte},
      ${disputeByPurchaseCte},
      filtered_purchases AS (
        SELECT
          sp.purchase_id,
          sp.created_utc::date AS purchase_date,
          sp.tenant_id,
          sp.test_id,
          sp.locale,
          sp.utm_source,
          sp.utm_campaign,
          sp.session_id,
          sp.offer_key,
          sp.product_type,
          sp.pricing_variant,
          COALESCE(sp.amount_eur, 0)::numeric AS gross_revenue_eur,
          COALESCE(refund_by_purchase.refunds_eur, 0)::numeric AS refunds_eur,
          COALESCE(dispute_by_purchase.disputes_eur, 0)::numeric AS disputes_eur,
          COALESCE(fee_by_purchase.payment_fees_eur, 0)::numeric AS payment_fees_eur,
          (
            CASE
              WHEN fee_by_purchase.purchase_id IS NOT NULL
                THEN COALESCE(fee_by_purchase.net_after_fees_eur, 0)::numeric
              ELSE COALESCE(sp.amount_eur, 0)::numeric
            END
            - COALESCE(refund_by_purchase.refunds_eur, 0)::numeric
            - COALESCE(dispute_by_purchase.disputes_eur, 0)::numeric
          ) AS net_revenue_eur
        FROM stripe_purchases sp
        LEFT JOIN fee_by_purchase
          ON fee_by_purchase.purchase_id = sp.purchase_id
        LEFT JOIN refund_by_purchase
          ON refund_by_purchase.purchase_id = sp.purchase_id
        LEFT JOIN dispute_by_purchase
          ON dispute_by_purchase.purchase_id = sp.purchase_id
        ${stripeFilter.whereSql}
      )
    `;

    return {
      cteSql,
      params: stripeFilter.params
    };
  }

  private async fetchEventAggregate(
    filters: AdminAnalyticsFilters,
    tables: ContentDbTableAvailability
  ): Promise<Omit<OverviewAggregate, "purchases" | "paid_conversion" | "gross_revenue_eur" | "net_revenue_eur" | "refunds_eur" | "disputes_eur" | "payment_fees_eur">> {
    if (!tables.analytics_events) {
      return {
        sessions: 0,
        test_starts: 0,
        test_completes: 0,
        paywall_views: 0,
        checkout_starts: 0
      };
    }

    const filter = buildContentDbEventFilterClause(filters);
    const [row] = await this.queryRows<Record<string, unknown>>(
      `
        SELECT
          COUNT(DISTINCT ae.session_id) AS sessions,
          COUNT(*) FILTER (WHERE ae.event_name = 'test_start') AS test_starts,
          COUNT(*) FILTER (WHERE ae.event_name = 'test_complete') AS test_completes,
          COUNT(*) FILTER (WHERE ae.event_name = 'paywall_view') AS paywall_views,
          COUNT(*) FILTER (WHERE ae.event_name = 'checkout_start') AS checkout_starts
        FROM analytics_events ae
        ${filter.whereSql}
      `,
      filter.params
    );

    return {
      sessions: toNumber(row?.sessions),
      test_starts: toNumber(row?.test_starts),
      test_completes: toNumber(row?.test_completes),
      paywall_views: toNumber(row?.paywall_views),
      checkout_starts: toNumber(row?.checkout_starts)
    };
  }

  private async fetchStripeAggregate(
    filters: AdminAnalyticsFilters,
    tables: ContentDbTableAvailability
  ): Promise<Pick<OverviewAggregate, "purchases" | "gross_revenue_eur" | "net_revenue_eur" | "refunds_eur" | "disputes_eur" | "payment_fees_eur">> {
    const cte = this.buildStripeCte(filters, tables);
    if (!cte) {
      return {
        purchases: 0,
        gross_revenue_eur: 0,
        net_revenue_eur: 0,
        refunds_eur: 0,
        disputes_eur: 0,
        payment_fees_eur: 0
      };
    }

    const [row] = await this.queryRows<Record<string, unknown>>(
      `
        WITH ${cte.cteSql}
        SELECT
          COUNT(*) AS purchases,
          COALESCE(SUM(fp.gross_revenue_eur), 0) AS gross_revenue_eur,
          COALESCE(SUM(fp.refunds_eur), 0) AS refunds_eur,
          COALESCE(SUM(fp.disputes_eur), 0) AS disputes_eur,
          COALESCE(SUM(fp.payment_fees_eur), 0) AS payment_fees_eur,
          COALESCE(SUM(fp.net_revenue_eur), 0) AS net_revenue_eur
        FROM filtered_purchases fp
      `,
      cte.params
    );

    return {
      purchases: toNumber(row?.purchases),
      gross_revenue_eur: roundCurrency(toNumber(row?.gross_revenue_eur)),
      net_revenue_eur: roundCurrency(toNumber(row?.net_revenue_eur)),
      refunds_eur: roundCurrency(toNumber(row?.refunds_eur)),
      disputes_eur: roundCurrency(toNumber(row?.disputes_eur)),
      payment_fees_eur: roundCurrency(toNumber(row?.payment_fees_eur))
    };
  }

  private async fetchOverviewAggregate(
    filters: AdminAnalyticsFilters,
    tables: ContentDbTableAvailability
  ): Promise<OverviewAggregate> {
    const [events, stripe] = await Promise.all([
      this.fetchEventAggregate(filters, tables),
      this.fetchStripeAggregate(filters, tables)
    ]);

    return {
      sessions: events.sessions,
      test_starts: events.test_starts,
      test_completes: events.test_completes,
      paywall_views: events.paywall_views,
      checkout_starts: events.checkout_starts,
      purchases: stripe.purchases,
      paid_conversion: safeRatio(stripe.purchases, events.sessions),
      gross_revenue_eur: stripe.gross_revenue_eur,
      net_revenue_eur: stripe.net_revenue_eur,
      refunds_eur: stripe.refunds_eur,
      disputes_eur: stripe.disputes_eur,
      payment_fees_eur: stripe.payment_fees_eur
    };
  }

  private async fetchEventByDimension(
    filters: AdminAnalyticsFilters,
    tables: ContentDbTableAvailability,
    dimensionSql: string,
    dimensionAlias: string,
    options: {
      requireValue?: boolean;
      includeTestFilter?: boolean;
      limit?: number;
      orderBy?: string;
    } = {}
  ): Promise<Array<Record<string, unknown>>> {
    if (!tables.analytics_events) {
      return [];
    }

    const filter = buildContentDbEventFilterClause(filters, {
      includeTestFilter: options.includeTestFilter
    });

    const conditions: string[] = [];
    if (options.requireValue) {
      conditions.push(`${dimensionSql} IS NOT NULL`);
    }

    const conditionSql = conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";

    const orderBy = options.orderBy ?? "sessions DESC";
    const limitSql = typeof options.limit === "number" ? `LIMIT ${options.limit}` : "";

    return this.queryRows<Record<string, unknown>>(
      `
        SELECT
          ${dimensionSql} AS ${dimensionAlias},
          COUNT(DISTINCT ae.session_id) AS sessions,
          COUNT(*) FILTER (WHERE ae.event_name = 'test_start') AS starts,
          COUNT(*) FILTER (WHERE ae.event_name = 'test_complete') AS completes,
          COUNT(*) FILTER (WHERE ae.event_name = 'paywall_view') AS paywall_views,
          COUNT(*) FILTER (WHERE ae.event_name = 'checkout_start') AS checkout_starts,
          MAX(ae.occurred_date)::text AS last_activity_date
        FROM analytics_events ae
        ${filter.whereSql}
        ${conditionSql}
        GROUP BY ${dimensionSql}
        ORDER BY ${orderBy}
        ${limitSql}
      `,
      filter.params
    );
  }

  private async fetchStripeByDimension(
    filters: AdminAnalyticsFilters,
    tables: ContentDbTableAvailability,
    dimensionSql: string,
    dimensionAlias: string,
    options: {
      requireValue?: boolean;
      includeTestFilter?: boolean;
      limit?: number;
      orderBy?: string;
    } = {}
  ): Promise<Array<Record<string, unknown>>> {
    const cte = this.buildStripeCte(
      options.includeTestFilter === false
        ? {
            ...filters,
            test_id: null
          }
        : filters,
      tables
    );

    if (!cte) {
      return [];
    }

    const whereSql = options.requireValue ? `WHERE ${dimensionSql} IS NOT NULL` : "";
    const orderBy = options.orderBy ?? "net_revenue_eur DESC";
    const limitSql = typeof options.limit === "number" ? `LIMIT ${options.limit}` : "";

    return this.queryRows<Record<string, unknown>>(
      `
        WITH ${cte.cteSql}
        SELECT
          ${dimensionSql} AS ${dimensionAlias},
          COUNT(*) AS purchases,
          COALESCE(SUM(fp.gross_revenue_eur), 0) AS gross_revenue_eur,
          COALESCE(SUM(fp.refunds_eur), 0) AS refunds_eur,
          COALESCE(SUM(fp.disputes_eur), 0) AS disputes_eur,
          COALESCE(SUM(fp.payment_fees_eur), 0) AS payment_fees_eur,
          COALESCE(SUM(fp.net_revenue_eur), 0) AS net_revenue_eur,
          MAX(fp.purchase_date)::text AS last_activity_date
        FROM filtered_purchases fp
        ${whereSql}
        GROUP BY ${dimensionSql}
        ORDER BY ${orderBy}
        ${limitSql}
      `,
      cte.params
    );
  }

  private parseEventMetrics(row: Record<string, unknown> | undefined): EventDimensionMetrics {
    if (!row) {
      return emptyEventMetrics();
    }

    return {
      sessions: toNumber(row.sessions),
      starts: toNumber(row.starts),
      completes: toNumber(row.completes),
      paywall_views: toNumber(row.paywall_views),
      checkout_starts: toNumber(row.checkout_starts),
      last_activity_date: toDateOnlyString(row.last_activity_date)
    };
  }

  private parseStripeMetrics(row: Record<string, unknown> | undefined): StripeDimensionMetrics {
    if (!row) {
      return emptyStripeMetrics();
    }

    return {
      purchases: toNumber(row.purchases),
      gross_revenue_eur: roundCurrency(toNumber(row.gross_revenue_eur)),
      refunds_eur: roundCurrency(toNumber(row.refunds_eur)),
      disputes_eur: roundCurrency(toNumber(row.disputes_eur)),
      payment_fees_eur: roundCurrency(toNumber(row.payment_fees_eur)),
      net_revenue_eur: roundCurrency(toNumber(row.net_revenue_eur)),
      last_activity_date: toDateOnlyString(row.last_activity_date)
    };
  }

  private mergeTimeseries(
    filters: AdminAnalyticsFilters,
    sessionsByDate: Map<string, number>,
    revenueByDate: Map<string, number>
  ): { sessions: TimeseriesPoint[]; revenue: TimeseriesPoint[] } {
    const dates = listDatesInclusive(filters.start, filters.end);

    return {
      sessions: dates.map((date) => ({
        date,
        value: sessionsByDate.get(date) ?? 0
      })),
      revenue: dates.map((date) => ({
        date,
        value: roundCurrency(revenueByDate.get(date) ?? 0)
      }))
    };
  }

  private async fetchEventSessionsTimeseries(
    filters: AdminAnalyticsFilters,
    tables: ContentDbTableAvailability
  ): Promise<Map<string, number>> {
    if (!tables.analytics_events) {
      return new Map();
    }

    const filter = buildContentDbEventFilterClause(filters);
    const rows = await this.queryRows<Record<string, unknown>>(
      `
        SELECT
          ae.occurred_date::text AS date,
          COUNT(DISTINCT ae.session_id) AS sessions
        FROM analytics_events ae
        ${filter.whereSql}
        GROUP BY ae.occurred_date
      `,
      filter.params
    );

    const result = new Map<string, number>();
    for (const row of rows) {
      const date = toDateOnlyString(row.date);
      if (!date) {
        continue;
      }

      result.set(date, toNumber(row.sessions));
    }

    return result;
  }

  private async fetchEventTestTimeseries(
    filters: AdminAnalyticsFilters,
    tables: ContentDbTableAvailability
  ): Promise<Map<string, { sessions: number; completes: number }>> {
    if (!tables.analytics_events) {
      return new Map();
    }

    const filter = buildContentDbEventFilterClause(filters);
    const rows = await this.queryRows<Record<string, unknown>>(
      `
        SELECT
          ae.occurred_date::text AS date,
          COUNT(DISTINCT ae.session_id) AS sessions,
          COUNT(*) FILTER (WHERE ae.event_name = 'test_complete') AS completes
        FROM analytics_events ae
        ${filter.whereSql}
        GROUP BY ae.occurred_date
      `,
      filter.params
    );

    const result = new Map<string, { sessions: number; completes: number }>();
    for (const row of rows) {
      const date = toDateOnlyString(row.date);
      if (!date) {
        continue;
      }

      result.set(date, {
        sessions: toNumber(row.sessions),
        completes: toNumber(row.completes)
      });
    }

    return result;
  }

  private async fetchStripeDaily(
    filters: AdminAnalyticsFilters,
    tables: ContentDbTableAvailability
  ): Promise<Map<string, StripeDimensionMetrics>> {
    const cte = this.buildStripeCte(filters, tables);
    if (!cte) {
      return new Map();
    }

    const rows = await this.queryRows<Record<string, unknown>>(
      `
        WITH ${cte.cteSql}
        SELECT
          fp.purchase_date::text AS date,
          COUNT(*) AS purchases,
          COALESCE(SUM(fp.gross_revenue_eur), 0) AS gross_revenue_eur,
          COALESCE(SUM(fp.refunds_eur), 0) AS refunds_eur,
          COALESCE(SUM(fp.disputes_eur), 0) AS disputes_eur,
          COALESCE(SUM(fp.payment_fees_eur), 0) AS payment_fees_eur,
          COALESCE(SUM(fp.net_revenue_eur), 0) AS net_revenue_eur
        FROM filtered_purchases fp
        GROUP BY fp.purchase_date
      `,
      cte.params
    );

    const result = new Map<string, StripeDimensionMetrics>();
    for (const row of rows) {
      const date = toDateOnlyString(row.date);
      if (!date) {
        continue;
      }

      result.set(date, {
        purchases: toNumber(row.purchases),
        gross_revenue_eur: roundCurrency(toNumber(row.gross_revenue_eur)),
        refunds_eur: roundCurrency(toNumber(row.refunds_eur)),
        disputes_eur: roundCurrency(toNumber(row.disputes_eur)),
        payment_fees_eur: roundCurrency(toNumber(row.payment_fees_eur)),
        net_revenue_eur: roundCurrency(toNumber(row.net_revenue_eur)),
        last_activity_date: date
      });
    }

    return result;
  }

  private async fetchSlugMap(
    filters: AdminAnalyticsFilters,
    tables: ContentDbTableAvailability
  ): Promise<Map<string, string>> {
    if (!tables.tests) {
      return new Map();
    }

    const params: unknown[] = [];
    const whereParts: string[] = [];
    if (filters.test_id) {
      params.push(filters.test_id);
      whereParts.push(`test_id = $${params.length}`);
    }

    const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";
    const rows = await this.queryRows<Record<string, unknown>>(
      `
        SELECT test_id, slug
        FROM tests
        ${whereSql}
      `,
      params
    );

    const map = new Map<string, string>();
    for (const row of rows) {
      const testId = toNullableString(row.test_id)?.trim();
      const slug = toNullableString(row.slug)?.trim();
      if (!testId || !slug) {
        continue;
      }

      map.set(testId, slug);
    }

    return map;
  }

  private async fetchPublicationState(
    filters: AdminAnalyticsFilters,
    tables: ContentDbTableAvailability
  ): Promise<Map<string, { is_published: boolean; version_id: string | null; enabled: boolean | null }>> {
    if (!tables.tests || !tables.tenant_tests) {
      return new Map();
    }

    const params: unknown[] = [];
    const whereParts: string[] = [];
    if (filters.tenant_id) {
      params.push(filters.tenant_id);
      whereParts.push(`tt.tenant_id = $${params.length}`);
    }

    if (filters.test_id) {
      params.push(filters.test_id);
      whereParts.push(`t.test_id = $${params.length}`);
    }

    const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

    const rows = await this.queryRows<Record<string, unknown>>(
      `
        SELECT
          tt.tenant_id,
          t.test_id,
          tt.published_version_id::text AS version_id,
          tt.is_enabled
        FROM tenant_tests tt
        INNER JOIN tests t
          ON t.id = tt.test_id
        ${whereSql}
      `,
      params
    );

    const result = new Map<string, { is_published: boolean; version_id: string | null; enabled: boolean | null }>();
    for (const row of rows) {
      const tenantId = toNullableString(row.tenant_id)?.trim();
      const testId = toNullableString(row.test_id)?.trim();
      if (!tenantId || !testId) {
        continue;
      }

      const versionId = toNullableString(row.version_id);
      const enabled = typeof row.is_enabled === "boolean" ? row.is_enabled : null;
      result.set(`${tenantId}::${testId}`, {
        is_published: Boolean(versionId),
        version_id: versionId,
        enabled
      });
    }

    return result;
  }

  private async fetchOverviewFreshness(
    filters: AdminAnalyticsFilters,
    tables: ContentDbTableAvailability
  ): Promise<AdminAnalyticsOverviewFreshnessRow[]> {
    const rows: AdminAnalyticsOverviewFreshnessRow[] = [];

    if (tables.analytics_events) {
      const filter = buildContentDbEventFilterClause(filters);
      const [maxRow] = await this.queryRows<Record<string, unknown>>(
        `
          SELECT MAX(ae.occurred_date)::text AS max_date
          FROM analytics_events ae
          ${filter.whereSql}
        `,
        filter.params
      );

      rows.push({
        table: "analytics_events",
        max_date: toDateOnlyString(maxRow?.max_date),
        available: true
      });
    } else {
      rows.push({
        table: "analytics_events",
        max_date: null,
        available: false
      });
    }

    if (tables.stripe_purchases) {
      const cte = this.buildStripeCte(filters, tables);
      const [maxRow] = cte
        ? await this.queryRows<Record<string, unknown>>(
            `
              WITH ${cte.cteSql}
              SELECT MAX(fp.purchase_date)::text AS max_date
              FROM filtered_purchases fp
            `,
            cte.params
          )
        : [undefined];

      rows.push({
        table: "stripe_purchases",
        max_date: toDateOnlyString(maxRow?.max_date),
        available: true
      });
    } else {
      rows.push({
        table: "stripe_purchases",
        max_date: null,
        available: false
      });
    }

    return rows;
  }

  private async fetchTrafficBreakdown(
    filters: AdminAnalyticsFilters,
    tables: ContentDbTableAvailability,
    dimension: TrafficDimension,
    topN: number
  ): Promise<AdminAnalyticsTrafficSegmentRow[]> {
    if (!tables.analytics_events) {
      return [];
    }

    const eventFilter = buildContentDbEventFilterClause(filters);
    const feeByPurchaseCte = tables.stripe_fees
      ? `
        fee_by_purchase AS (
          SELECT
            purchase_id,
            SUM(COALESCE(fee_eur, 0))::numeric AS payment_fees_eur,
            SUM(COALESCE(net_eur, 0))::numeric AS net_after_fees_eur
          FROM stripe_fees
          GROUP BY purchase_id
        )
      `
      : `
        fee_by_purchase AS (
          SELECT
            NULL::text AS purchase_id,
            0::numeric AS payment_fees_eur,
            0::numeric AS net_after_fees_eur
          WHERE FALSE
        )
      `;

    const refundByPurchaseCte = tables.stripe_refunds
      ? `
        refund_by_purchase AS (
          SELECT
            purchase_id,
            SUM(COALESCE(amount_eur, 0))::numeric AS refunds_eur
          FROM stripe_refunds
          GROUP BY purchase_id
        )
      `
      : `
        refund_by_purchase AS (
          SELECT
            NULL::text AS purchase_id,
            0::numeric AS refunds_eur
          WHERE FALSE
        )
      `;

    const disputeByPurchaseCte = tables.stripe_disputes
      ? `
        dispute_by_purchase AS (
          SELECT
            purchase_id,
            SUM(COALESCE(amount_eur, 0))::numeric AS disputes_eur
          FROM stripe_disputes
          GROUP BY purchase_id
        )
      `
      : `
        dispute_by_purchase AS (
          SELECT
            NULL::text AS purchase_id,
            0::numeric AS disputes_eur
          WHERE FALSE
        )
      `;

    const filteredPurchasesCte = tables.stripe_purchases
      ? `
        filtered_purchases AS (
          SELECT
            sp.purchase_id,
            sp.session_id,
            (
              CASE
                WHEN fee_by_purchase.purchase_id IS NOT NULL
                  THEN COALESCE(fee_by_purchase.net_after_fees_eur, 0)::numeric
                ELSE COALESCE(sp.amount_eur, 0)::numeric
              END
              - COALESCE(refund_by_purchase.refunds_eur, 0)::numeric
              - COALESCE(dispute_by_purchase.disputes_eur, 0)::numeric
            ) AS net_revenue_eur
          FROM stripe_purchases sp
          LEFT JOIN fee_by_purchase
            ON fee_by_purchase.purchase_id = sp.purchase_id
          LEFT JOIN refund_by_purchase
            ON refund_by_purchase.purchase_id = sp.purchase_id
          LEFT JOIN dispute_by_purchase
            ON dispute_by_purchase.purchase_id = sp.purchase_id
          WHERE sp.created_utc::date >= $1::date
            AND sp.created_utc::date <= $2::date
        )
      `
      : `
        filtered_purchases AS (
          SELECT
            NULL::text AS purchase_id,
            NULL::text AS session_id,
            0::numeric AS net_revenue_eur
          WHERE FALSE
        )
      `;

    const rows = await this.queryRows<Record<string, unknown>>(
      `
        WITH
        event_sessions AS (
          SELECT
            ae.session_id,
            COALESCE(NULLIF(MAX(ae.utm_source), ''), '(none)') AS utm_source,
            COALESCE(NULLIF(MAX(ae.utm_campaign), ''), '(none)') AS utm_campaign,
            COALESCE(NULLIF(MAX(ae.referrer), ''), '(none)') AS referrer,
            COALESCE(NULLIF(MAX(ae.device_type), ''), '(unknown)') AS device_type,
            COALESCE(NULLIF(MAX(ae.country), ''), '(unknown)') AS country
          FROM analytics_events ae
          ${eventFilter.whereSql}
          GROUP BY ae.session_id
        ),
        ${feeByPurchaseCte},
        ${refundByPurchaseCte},
        ${disputeByPurchaseCte},
        ${filteredPurchasesCte},
        segment_metrics AS (
          SELECT
            event_sessions.${dimension} AS segment,
            COUNT(DISTINCT event_sessions.session_id) AS sessions,
            COUNT(DISTINCT fp.purchase_id) AS purchases,
            COALESCE(SUM(fp.net_revenue_eur), 0) AS net_revenue_eur
          FROM event_sessions
          LEFT JOIN filtered_purchases fp
            ON fp.session_id = event_sessions.session_id
          GROUP BY event_sessions.${dimension}
        )
        SELECT
          segment,
          sessions,
          purchases,
          net_revenue_eur
        FROM segment_metrics
        ORDER BY sessions DESC, segment ASC
        LIMIT ${topN}
      `,
      eventFilter.params
    );

    return rows.map((row) => {
      const segment = dimension === "device_type" || dimension === "country"
        ? normalizeTrafficSegment(row.segment, "(unknown)")
        : normalizeTrafficSegment(row.segment, "(none)");
      const sessions = toNumber(row.sessions);
      const purchases = toNumber(row.purchases);
      return {
        segment,
        sessions,
        purchases,
        paid_conversion: safeRatio(purchases, sessions),
        net_revenue_eur: roundCurrency(toNumber(row.net_revenue_eur))
      };
    });
  }

  private async fetchDataFreshnessRows(
    filters: AdminAnalyticsFilters,
    tables: ContentDbTableAvailability
  ): Promise<AdminAnalyticsDataFreshnessRow[]> {
    const now = Date.now();
    const rows: AdminAnalyticsDataFreshnessRow[] = [];

    const pushRow = (dataset: string, table: string, lastLoadedUtc: string | null): void => {
      const thresholds = resolveFreshnessThresholds(dataset, table);
      const lagMinutes = lastLoadedUtc
        ? Math.max(0, Math.round((now - new Date(lastLoadedUtc).getTime()) / (60 * 1000)))
        : null;
      rows.push({
        dataset,
        table,
        last_loaded_utc: lastLoadedUtc,
        lag_minutes: lagMinutes,
        warn_after_minutes: thresholds.warn_after_minutes,
        error_after_minutes: thresholds.error_after_minutes,
        status: evaluateFreshnessStatus(lagMinutes, thresholds)
      });
    };

    if (tables.analytics_events) {
      const filter = buildContentDbEventFilterClause(filters);
      const [row] = await this.queryRows<Record<string, unknown>>(
        `
          SELECT MAX(ae.occurred_at) AS last_loaded_utc
          FROM analytics_events ae
          ${filter.whereSql}
        `,
        filter.params
      );

      pushRow("content_db", "analytics_events", toNullableString(row?.last_loaded_utc));
    } else {
      pushRow("content_db", "analytics_events", null);
    }

    if (tables.stripe_purchases) {
      const stripeFilter = buildContentDbStripeFilterClause(filters, {
        alias: "sp",
        canFilterByDeviceType: tables.analytics_events
      });
      const [row] = await this.queryRows<Record<string, unknown>>(
        `
          SELECT MAX(sp.created_utc) AS last_loaded_utc
          FROM stripe_purchases sp
          ${stripeFilter.whereSql}
        `,
        stripeFilter.params
      );
      pushRow("content_db", "stripe_purchases", toNullableString(row?.last_loaded_utc));
    } else {
      pushRow("content_db", "stripe_purchases", null);
    }

    if (tables.stripe_refunds) {
      const [row] = await this.queryRows<Record<string, unknown>>(
        `SELECT MAX(created_utc) AS last_loaded_utc FROM stripe_refunds`
      );
      pushRow("content_db", "stripe_refunds", toNullableString(row?.last_loaded_utc));
    } else {
      pushRow("content_db", "stripe_refunds", null);
    }

    if (tables.stripe_disputes) {
      const [row] = await this.queryRows<Record<string, unknown>>(
        `SELECT MAX(created_utc) AS last_loaded_utc FROM stripe_disputes`
      );
      pushRow("content_db", "stripe_disputes", toNullableString(row?.last_loaded_utc));
    } else {
      pushRow("content_db", "stripe_disputes", null);
    }

    if (tables.stripe_fees) {
      const [row] = await this.queryRows<Record<string, unknown>>(
        `SELECT MAX(created_utc) AS last_loaded_utc FROM stripe_fees`
      );
      pushRow("content_db", "stripe_fees", toNullableString(row?.last_loaded_utc));
    } else {
      pushRow("content_db", "stripe_fees", null);
    }

    return rows;
  }

  private buildDataHealthChecks(
    tables: ContentDbTableAvailability,
    aggregate: OverviewAggregate,
    freshness: AdminAnalyticsDataFreshnessRow[]
  ): AdminAnalyticsDataHealthCheck[] {
    const freshnessStatus = combineHealthStatus(freshness.map((row) => row.status));
    const tableStatus: AdminAnalyticsDataHealthStatus =
      tables.analytics_events && tables.stripe_purchases ? "ok" : "warn";

    const checks: AdminAnalyticsDataHealthCheck[] = [
      {
        key: "table_availability",
        label: "Required table availability",
        status: tableStatus,
        detail: tables.analytics_events && tables.stripe_purchases
          ? "analytics_events and stripe_purchases tables are available."
          : "One or more required tables are missing; metrics will default to zero.",
        hint: tables.analytics_events && tables.stripe_purchases
          ? null
          : "Run content DB migrations to create missing analytics tables.",
        last_updated_utc: generatedAtUtc()
      },
      {
        key: "events_presence",
        label: "Event data presence",
        status: aggregate.sessions > 0 ? "ok" : "warn",
        detail: aggregate.sessions > 0
          ? `Found ${aggregate.sessions} sessions in selected range.`
          : "No analytics_events sessions in selected range.",
        hint: aggregate.sessions > 0
          ? null
          : "Ensure event ingestion routes are writing into analytics_events.",
        last_updated_utc: generatedAtUtc()
      },
      {
        key: "stripe_presence",
        label: "Stripe data presence",
        status: aggregate.purchases > 0 ? "ok" : "warn",
        detail: aggregate.purchases > 0
          ? `Found ${aggregate.purchases} purchases in selected range.`
          : "No stripe_purchases rows in selected range.",
        hint: aggregate.purchases > 0
          ? null
          : "Verify Stripe webhook ingestion and stripe_* table writes.",
        last_updated_utc: generatedAtUtc()
      },
      {
        key: "freshness",
        label: "Freshness status",
        status: freshnessStatus,
        detail: `Overall freshness is ${freshnessStatus}.`,
        hint: freshnessStatus === "ok" ? null : "Inspect stale tables and rerun ingestion jobs.",
        last_updated_utc: generatedAtUtc()
      }
    ];

    return checks;
  }

  async getOverview(filters: AdminAnalyticsFilters): Promise<AdminAnalyticsOverviewResponse> {
    const tables = await this.resolveTableAvailability();

    const [
      aggregate,
      eventSessionsByDate,
      stripeDaily,
      topTestsEventRows,
      topTestsStripeRows,
      topTenantsEventRows,
      topTenantsStripeRows,
      freshness
    ] = await Promise.all([
      this.fetchOverviewAggregate(filters, tables),
      this.fetchEventSessionsTimeseries(filters, tables),
      this.fetchStripeDaily(filters, tables),
      this.fetchEventByDimension(filters, tables, "ae.test_id", "test_id", {
        requireValue: true,
        orderBy: "sessions DESC, ae.test_id ASC",
        limit: OVERVIEW_TOP_ROWS_LIMIT * 3
      }),
      this.fetchStripeByDimension(filters, tables, "fp.test_id", "test_id", {
        requireValue: true,
        orderBy: "net_revenue_eur DESC, fp.test_id ASC",
        limit: OVERVIEW_TOP_ROWS_LIMIT * 3
      }),
      this.fetchEventByDimension(filters, tables, "ae.tenant_id", "tenant_id", {
        requireValue: true,
        orderBy: "sessions DESC, ae.tenant_id ASC",
        limit: OVERVIEW_TOP_ROWS_LIMIT * 3
      }),
      this.fetchStripeByDimension(filters, tables, "fp.tenant_id", "tenant_id", {
        requireValue: true,
        orderBy: "net_revenue_eur DESC, fp.tenant_id ASC",
        limit: OVERVIEW_TOP_ROWS_LIMIT * 3
      }),
      this.fetchOverviewFreshness(filters, tables)
    ]);

    const revenueByDate = new Map<string, number>();
    for (const [date, metrics] of stripeDaily.entries()) {
      revenueByDate.set(date, metrics.net_revenue_eur);
    }

    const mergedSeries = this.mergeTimeseries(filters, eventSessionsByDate, revenueByDate);

    const testsMap = new Map<string, { sessions: number; purchases: number; net_revenue_eur: number }>();
    for (const row of topTestsEventRows) {
      const testId = toNullableString(row.test_id)?.trim();
      if (!testId) {
        continue;
      }

      testsMap.set(testId, {
        sessions: toNumber(row.sessions),
        purchases: 0,
        net_revenue_eur: 0
      });
    }

    for (const row of topTestsStripeRows) {
      const testId = toNullableString(row.test_id)?.trim();
      if (!testId) {
        continue;
      }

      const current = testsMap.get(testId) ?? { sessions: 0, purchases: 0, net_revenue_eur: 0 };
      testsMap.set(testId, {
        sessions: current.sessions,
        purchases: toNumber(row.purchases),
        net_revenue_eur: roundCurrency(toNumber(row.net_revenue_eur))
      });
    }

    const top_tests = [...testsMap.entries()]
      .map(([test_id, value]) => ({
        test_id,
        net_revenue_eur: value.net_revenue_eur,
        purchase_conversion: safeRatio(value.purchases, value.sessions),
        purchases: value.purchases
      }))
      .sort((left, right) => {
        if (right.net_revenue_eur !== left.net_revenue_eur) {
          return right.net_revenue_eur - left.net_revenue_eur;
        }

        if (right.purchase_conversion !== left.purchase_conversion) {
          return right.purchase_conversion - left.purchase_conversion;
        }

        return left.test_id.localeCompare(right.test_id);
      })
      .slice(0, OVERVIEW_TOP_ROWS_LIMIT);

    const tenantsMap = new Map<string, { purchases: number; net_revenue_eur: number }>();
    for (const row of topTenantsEventRows) {
      const tenantId = toNullableString(row.tenant_id)?.trim();
      if (!tenantId) {
        continue;
      }

      if (!tenantsMap.has(tenantId)) {
        tenantsMap.set(tenantId, {
          purchases: 0,
          net_revenue_eur: 0
        });
      }
    }

    for (const row of topTenantsStripeRows) {
      const tenantId = toNullableString(row.tenant_id)?.trim();
      if (!tenantId) {
        continue;
      }

      tenantsMap.set(tenantId, {
        purchases: toNumber(row.purchases),
        net_revenue_eur: roundCurrency(toNumber(row.net_revenue_eur))
      });
    }

    const top_tenants = [...tenantsMap.entries()]
      .map(([tenant_id, value]) => ({
        tenant_id,
        purchases: value.purchases,
        net_revenue_eur: value.net_revenue_eur
      }))
      .sort((left, right) => {
        if (right.net_revenue_eur !== left.net_revenue_eur) {
          return right.net_revenue_eur - left.net_revenue_eur;
        }

        return left.tenant_id.localeCompare(right.tenant_id);
      })
      .slice(0, OVERVIEW_TOP_ROWS_LIMIT);

    return {
      filters,
      generated_at_utc: generatedAtUtc(),
      kpis: buildOverviewKpis(aggregate),
      funnel: buildOverviewFunnel(aggregate),
      visits_timeseries: mergedSeries.sessions,
      revenue_timeseries: mergedSeries.revenue,
      top_tests,
      top_tenants,
      data_freshness: freshness,
      alerts_available: false,
      alerts: []
    };
  }

  async getTests(filters: AdminAnalyticsFilters): Promise<AdminAnalyticsTestsResponse> {
    const tables = await this.resolveTableAvailability();

    const [eventRows, stripeRows, byTenantRows, slugMap] = await Promise.all([
      this.fetchEventByDimension(filters, tables, "ae.test_id", "test_id", {
        requireValue: true,
        orderBy: "sessions DESC, ae.test_id ASC",
        limit: TESTS_ROWS_LIMIT
      }),
      this.fetchStripeByDimension(filters, tables, "fp.test_id", "test_id", {
        requireValue: true,
        orderBy: "net_revenue_eur DESC, fp.test_id ASC",
        limit: TESTS_ROWS_LIMIT
      }),
      this.fetchEventByDimension(filters, tables, "CONCAT(ae.test_id, '::', ae.tenant_id)", "test_tenant_key", {
        requireValue: true,
        orderBy: "sessions DESC",
        limit: TESTS_ROWS_LIMIT * 5
      }),
      this.fetchSlugMap(filters, tables)
    ]);

    const eventMap = new Map<string, EventDimensionMetrics>();
    for (const row of eventRows) {
      const testId = toNullableString(row.test_id)?.trim();
      if (!testId) {
        continue;
      }

      eventMap.set(testId, this.parseEventMetrics(row));
    }

    const stripeMap = new Map<string, StripeDimensionMetrics>();
    for (const row of stripeRows) {
      const testId = toNullableString(row.test_id)?.trim();
      if (!testId) {
        continue;
      }

      stripeMap.set(testId, this.parseStripeMetrics(row));
    }

    const topTenantByTest = new Map<string, { tenant_id: string; sessions: number }>();
    for (const row of byTenantRows) {
      const key = toNullableString(row.test_tenant_key);
      if (!key || !key.includes("::")) {
        continue;
      }

      const [testId, tenantId] = key.split("::");
      if (!testId || !tenantId) {
        continue;
      }

      const sessions = toNumber(row.sessions);
      const current = topTenantByTest.get(testId);
      if (!current || sessions > current.sessions) {
        topTenantByTest.set(testId, {
          tenant_id: tenantId,
          sessions
        });
      }
    }

    const keys = new Set<string>([...eventMap.keys(), ...stripeMap.keys()]);
    if (filters.test_id) {
      keys.add(filters.test_id);
    }

    const rows: AdminAnalyticsTestsRow[] = [...keys]
      .map((testId) => {
        const eventMetrics = eventMap.get(testId) ?? emptyEventMetrics();
        const stripeMetrics = stripeMap.get(testId) ?? emptyStripeMetrics();
        const slug = slugMap.get(testId);

        const row: AdminAnalyticsTestsRow = {
          test_id: testId,
          sessions: eventMetrics.sessions,
          starts: eventMetrics.starts,
          completes: eventMetrics.completes,
          purchases: stripeMetrics.purchases,
          paid_conversion: safeRatio(stripeMetrics.purchases, eventMetrics.sessions),
          net_revenue_eur: stripeMetrics.net_revenue_eur,
          refunds_eur: stripeMetrics.refunds_eur,
          top_tenant_id: topTenantByTest.get(testId)?.tenant_id ?? null,
          last_activity_date: maxDate(eventMetrics.last_activity_date, stripeMetrics.last_activity_date)
        };

        if (slug) {
          row.slug = slug;
        }

        return row;
      })
      .sort((left, right) => {
        if (right.net_revenue_eur !== left.net_revenue_eur) {
          return right.net_revenue_eur - left.net_revenue_eur;
        }

        return left.test_id.localeCompare(right.test_id);
      })
      .slice(0, TESTS_ROWS_LIMIT);

    return {
      filters,
      generated_at_utc: generatedAtUtc(),
      rows
    };
  }

  async getTestDetail(
    testId: string,
    filters: AdminAnalyticsFilters
  ): Promise<AdminAnalyticsTestDetailResponse> {
    const tables = await this.resolveTableAvailability();

    const scopedFilters: AdminAnalyticsFilters = {
      ...filters,
      test_id: testId
    };

    const [
      aggregate,
      eventTimeseries,
      stripeDaily,
      tenantEvents,
      tenantStripe,
      localeEvents,
      localeStripe,
      paywallRows
    ] = await Promise.all([
      this.fetchOverviewAggregate(scopedFilters, tables),
      this.fetchEventTestTimeseries(scopedFilters, tables),
      this.fetchStripeDaily(scopedFilters, tables),
      this.fetchEventByDimension(scopedFilters, tables, "ae.tenant_id", "tenant_id", {
        requireValue: true,
        orderBy: "sessions DESC, ae.tenant_id ASC",
        limit: DETAIL_ROWS_LIMIT
      }),
      this.fetchStripeByDimension(scopedFilters, tables, "fp.tenant_id", "tenant_id", {
        requireValue: true,
        orderBy: "net_revenue_eur DESC, fp.tenant_id ASC",
        limit: DETAIL_ROWS_LIMIT
      }),
      this.fetchEventByDimension(scopedFilters, tables, "COALESCE(NULLIF(ae.locale, ''), 'unknown')", "locale", {
        orderBy: "sessions DESC, locale ASC",
        limit: DETAIL_ROWS_LIMIT
      }),
      this.fetchStripeByDimension(scopedFilters, tables, "COALESCE(NULLIF(fp.locale, ''), 'unknown')", "locale", {
        orderBy: "net_revenue_eur DESC, locale ASC",
        limit: DETAIL_ROWS_LIMIT
      }),
      this.fetchEventByDimension(scopedFilters, tables, "'paywall'", "scope", {
        orderBy: "sessions DESC",
        limit: 1
      })
    ]);

    const timeseriesDates = listDatesInclusive(scopedFilters.start, scopedFilters.end);
    const timeseries: AdminAnalyticsTestTimeseriesRow[] = timeseriesDates.map((date) => {
      const eventRow = eventTimeseries.get(date);
      const stripeRow = stripeDaily.get(date);
      return {
        date,
        sessions: eventRow?.sessions ?? 0,
        completes: eventRow?.completes ?? 0,
        purchases: stripeRow?.purchases ?? 0,
        net_revenue_eur: stripeRow?.net_revenue_eur ?? 0
      };
    });

    const tenantEventMap = new Map<string, EventDimensionMetrics>();
    for (const row of tenantEvents) {
      const tenantId = toNullableString(row.tenant_id)?.trim();
      if (!tenantId) {
        continue;
      }

      tenantEventMap.set(tenantId, this.parseEventMetrics(row));
    }

    const tenantStripeMap = new Map<string, StripeDimensionMetrics>();
    for (const row of tenantStripe) {
      const tenantId = toNullableString(row.tenant_id)?.trim();
      if (!tenantId) {
        continue;
      }

      tenantStripeMap.set(tenantId, this.parseStripeMetrics(row));
    }

    const tenantKeys = new Set<string>([...tenantEventMap.keys(), ...tenantStripeMap.keys()]);
    const tenant_breakdown: AdminAnalyticsTestTenantRow[] = [...tenantKeys]
      .map((tenantId) => {
        const eventMetrics = tenantEventMap.get(tenantId) ?? emptyEventMetrics();
        const stripeMetrics = tenantStripeMap.get(tenantId) ?? emptyStripeMetrics();

        return {
          tenant_id: tenantId,
          sessions: eventMetrics.sessions,
          starts: eventMetrics.starts,
          completes: eventMetrics.completes,
          purchases: stripeMetrics.purchases,
          paid_conversion: safeRatio(stripeMetrics.purchases, eventMetrics.sessions),
          net_revenue_eur: stripeMetrics.net_revenue_eur,
          refunds_eur: stripeMetrics.refunds_eur
        };
      })
      .sort((left, right) => {
        if (right.net_revenue_eur !== left.net_revenue_eur) {
          return right.net_revenue_eur - left.net_revenue_eur;
        }

        return left.tenant_id.localeCompare(right.tenant_id);
      })
      .slice(0, DETAIL_ROWS_LIMIT);

    const localeEventMap = new Map<string, EventDimensionMetrics>();
    for (const row of localeEvents) {
      const locale = normalizeTrafficSegment(row.locale, "(unknown)");
      localeEventMap.set(locale, this.parseEventMetrics(row));
    }

    const localeStripeMap = new Map<string, StripeDimensionMetrics>();
    for (const row of localeStripe) {
      const locale = normalizeTrafficSegment(row.locale, "(unknown)");
      localeStripeMap.set(locale, this.parseStripeMetrics(row));
    }

    const localeKeys = new Set<string>([...localeEventMap.keys(), ...localeStripeMap.keys()]);
    const locale_breakdown: AdminAnalyticsTestLocaleRow[] = [...localeKeys]
      .map((locale) => {
        const eventMetrics = localeEventMap.get(locale) ?? emptyEventMetrics();
        const stripeMetrics = localeStripeMap.get(locale) ?? emptyStripeMetrics();

        return {
          locale,
          sessions: eventMetrics.sessions,
          starts: eventMetrics.starts,
          completes: eventMetrics.completes,
          purchases: stripeMetrics.purchases,
          paid_conversion: safeRatio(stripeMetrics.purchases, eventMetrics.sessions),
          net_revenue_eur: stripeMetrics.net_revenue_eur,
          refunds_eur: stripeMetrics.refunds_eur
        };
      })
      .sort((left, right) => {
        if (right.net_revenue_eur !== left.net_revenue_eur) {
          return right.net_revenue_eur - left.net_revenue_eur;
        }

        return left.locale.localeCompare(right.locale);
      })
      .slice(0, DETAIL_ROWS_LIMIT);

    const paywallMetricsRow = paywallRows[0];
    const paywallViews = toNumber(paywallMetricsRow?.paywall_views);
    const checkoutStarts = toNumber(paywallMetricsRow?.checkout_starts);

    return {
      filters: scopedFilters,
      generated_at_utc: generatedAtUtc(),
      test_id: testId,
      kpis: buildOverviewKpis(aggregate),
      funnel: buildOverviewFunnel(aggregate),
      timeseries,
      tenant_breakdown,
      locale_breakdown,
      paywall_metrics_available: tables.analytics_events,
      paywall_metrics: tables.analytics_events
        ? {
            views: paywallViews,
            checkout_starts: checkoutStarts,
            checkout_success: aggregate.purchases,
            checkout_start_rate: safeRatio(checkoutStarts, paywallViews),
            checkout_success_rate: safeRatio(aggregate.purchases, checkoutStarts)
          }
        : null
    };
  }

  async getTenants(filters: AdminAnalyticsFilters): Promise<AdminAnalyticsTenantsResponse> {
    const tables = await this.resolveTableAvailability();

    const [tenantEvents, tenantStripe, testByTenantRows] = await Promise.all([
      this.fetchEventByDimension(filters, tables, "ae.tenant_id", "tenant_id", {
        requireValue: true,
        orderBy: "sessions DESC, ae.tenant_id ASC",
        limit: TENANTS_ROWS_LIMIT
      }),
      this.fetchStripeByDimension(filters, tables, "fp.tenant_id", "tenant_id", {
        requireValue: true,
        orderBy: "net_revenue_eur DESC, fp.tenant_id ASC",
        limit: TENANTS_ROWS_LIMIT
      }),
      this.fetchEventByDimension(filters, tables, "CONCAT(ae.tenant_id, '::', ae.test_id)", "tenant_test_key", {
        requireValue: true,
        orderBy: "sessions DESC",
        limit: TENANTS_ROWS_LIMIT * 10
      })
    ]);

    const eventMap = new Map<string, EventDimensionMetrics>();
    for (const row of tenantEvents) {
      const tenantId = toNullableString(row.tenant_id)?.trim();
      if (!tenantId) {
        continue;
      }

      eventMap.set(tenantId, this.parseEventMetrics(row));
    }

    const stripeMap = new Map<string, StripeDimensionMetrics>();
    for (const row of tenantStripe) {
      const tenantId = toNullableString(row.tenant_id)?.trim();
      if (!tenantId) {
        continue;
      }

      stripeMap.set(tenantId, this.parseStripeMetrics(row));
    }

    const topTestByTenant = new Map<string, { test_id: string; sessions: number }>();
    for (const row of testByTenantRows) {
      const key = toNullableString(row.tenant_test_key);
      if (!key || !key.includes("::")) {
        continue;
      }

      const [tenantId, testId] = key.split("::");
      if (!tenantId || !testId) {
        continue;
      }

      const sessions = toNumber(row.sessions);
      const current = topTestByTenant.get(tenantId);
      if (!current || sessions > current.sessions) {
        topTestByTenant.set(tenantId, {
          test_id: testId,
          sessions
        });
      }
    }

    const keys = new Set<string>([...eventMap.keys(), ...stripeMap.keys()]);
    if (filters.tenant_id) {
      keys.add(filters.tenant_id);
    }

    const rows: AdminAnalyticsTenantsRow[] = [...keys]
      .map((tenantId) => {
        const eventMetrics = eventMap.get(tenantId) ?? emptyEventMetrics();
        const stripeMetrics = stripeMap.get(tenantId) ?? emptyStripeMetrics();

        return {
          tenant_id: tenantId,
          sessions: eventMetrics.sessions,
          test_starts: eventMetrics.starts,
          test_completions: eventMetrics.completes,
          purchases: stripeMetrics.purchases,
          paid_conversion: safeRatio(stripeMetrics.purchases, eventMetrics.sessions),
          net_revenue_eur: stripeMetrics.net_revenue_eur,
          refunds_eur: stripeMetrics.refunds_eur,
          top_test_id: topTestByTenant.get(tenantId)?.test_id ?? null,
          last_activity_date: maxDate(eventMetrics.last_activity_date, stripeMetrics.last_activity_date)
        };
      })
      .sort((left, right) => {
        if (right.net_revenue_eur !== left.net_revenue_eur) {
          return right.net_revenue_eur - left.net_revenue_eur;
        }

        return left.tenant_id.localeCompare(right.tenant_id);
      })
      .slice(0, TENANTS_ROWS_LIMIT);

    return {
      filters,
      generated_at_utc: generatedAtUtc(),
      rows,
      total_rows: rows.length
    };
  }

  async getTenantDetail(
    tenantId: string,
    filters: AdminAnalyticsFilters
  ): Promise<AdminAnalyticsTenantDetailResponse> {
    const tables = await this.resolveTableAvailability();

    const scopedFilters: AdminAnalyticsFilters = {
      ...filters,
      tenant_id: tenantId
    };

    const [
      aggregate,
      sessionsTimeseries,
      stripeDaily,
      topTestsEvents,
      topTestsStripe,
      localeEvents,
      localeStripe
    ] = await Promise.all([
      this.fetchOverviewAggregate(scopedFilters, tables),
      this.fetchEventSessionsTimeseries(scopedFilters, tables),
      this.fetchStripeDaily(scopedFilters, tables),
      this.fetchEventByDimension(scopedFilters, tables, "ae.test_id", "test_id", {
        requireValue: true,
        orderBy: "sessions DESC, ae.test_id ASC",
        limit: DETAIL_ROWS_LIMIT
      }),
      this.fetchStripeByDimension(scopedFilters, tables, "fp.test_id", "test_id", {
        requireValue: true,
        orderBy: "net_revenue_eur DESC, fp.test_id ASC",
        limit: DETAIL_ROWS_LIMIT
      }),
      this.fetchEventByDimension(scopedFilters, tables, "COALESCE(NULLIF(ae.locale, ''), 'unknown')", "locale", {
        orderBy: "sessions DESC, locale ASC",
        limit: DETAIL_ROWS_LIMIT
      }),
      this.fetchStripeByDimension(scopedFilters, tables, "COALESCE(NULLIF(fp.locale, ''), 'unknown')", "locale", {
        orderBy: "net_revenue_eur DESC, locale ASC",
        limit: DETAIL_ROWS_LIMIT
      })
    ]);

    const revenueByDate = new Map<string, number>();
    for (const [date, metrics] of stripeDaily.entries()) {
      revenueByDate.set(date, metrics.net_revenue_eur);
    }

    const mergedTimeseries = this.mergeTimeseries(scopedFilters, sessionsTimeseries, revenueByDate);

    const testEventMap = new Map<string, EventDimensionMetrics>();
    for (const row of topTestsEvents) {
      const testId = toNullableString(row.test_id)?.trim();
      if (!testId) {
        continue;
      }

      testEventMap.set(testId, this.parseEventMetrics(row));
    }

    const testStripeMap = new Map<string, StripeDimensionMetrics>();
    for (const row of topTestsStripe) {
      const testId = toNullableString(row.test_id)?.trim();
      if (!testId) {
        continue;
      }

      testStripeMap.set(testId, this.parseStripeMetrics(row));
    }

    const topTestKeys = new Set<string>([...testEventMap.keys(), ...testStripeMap.keys()]);
    const top_tests: AdminAnalyticsTenantTopTestRow[] = [...topTestKeys]
      .map((test_id) => {
        const eventMetrics = testEventMap.get(test_id) ?? emptyEventMetrics();
        const stripeMetrics = testStripeMap.get(test_id) ?? emptyStripeMetrics();

        return {
          test_id,
          sessions: eventMetrics.sessions,
          test_starts: eventMetrics.starts,
          test_completions: eventMetrics.completes,
          purchases: stripeMetrics.purchases,
          paid_conversion: safeRatio(stripeMetrics.purchases, eventMetrics.sessions),
          net_revenue_eur: stripeMetrics.net_revenue_eur,
          refunds_eur: stripeMetrics.refunds_eur
        };
      })
      .sort((left, right) => {
        if (right.net_revenue_eur !== left.net_revenue_eur) {
          return right.net_revenue_eur - left.net_revenue_eur;
        }

        return left.test_id.localeCompare(right.test_id);
      })
      .slice(0, DETAIL_ROWS_LIMIT);

    const localeEventMap = new Map<string, EventDimensionMetrics>();
    for (const row of localeEvents) {
      const locale = normalizeTrafficSegment(row.locale, "(unknown)");
      localeEventMap.set(locale, this.parseEventMetrics(row));
    }

    const localeStripeMap = new Map<string, StripeDimensionMetrics>();
    for (const row of localeStripe) {
      const locale = normalizeTrafficSegment(row.locale, "(unknown)");
      localeStripeMap.set(locale, this.parseStripeMetrics(row));
    }

    const localeKeys = new Set<string>([...localeEventMap.keys(), ...localeStripeMap.keys()]);
    const locale_breakdown: AdminAnalyticsTenantLocaleRow[] = [...localeKeys]
      .map((locale) => {
        const eventMetrics = localeEventMap.get(locale) ?? emptyEventMetrics();
        const stripeMetrics = localeStripeMap.get(locale) ?? emptyStripeMetrics();

        return {
          locale,
          sessions: eventMetrics.sessions,
          test_starts: eventMetrics.starts,
          test_completions: eventMetrics.completes,
          purchases: stripeMetrics.purchases,
          paid_conversion: safeRatio(stripeMetrics.purchases, eventMetrics.sessions),
          net_revenue_eur: stripeMetrics.net_revenue_eur,
          refunds_eur: stripeMetrics.refunds_eur
        };
      })
      .sort((left, right) => {
        if (right.net_revenue_eur !== left.net_revenue_eur) {
          return right.net_revenue_eur - left.net_revenue_eur;
        }

        return left.locale.localeCompare(right.locale);
      })
      .slice(0, DETAIL_ROWS_LIMIT);

    const hasData = aggregate.sessions > 0 || aggregate.purchases > 0;

    return {
      filters: scopedFilters,
      generated_at_utc: generatedAtUtc(),
      tenant_id: tenantId,
      kpis: hasData ? buildOverviewKpis(aggregate) : [],
      funnel: hasData ? buildOverviewFunnel(aggregate) : [],
      sessions_timeseries: mergedTimeseries.sessions,
      revenue_timeseries: mergedTimeseries.revenue,
      top_tests,
      top_tests_total: top_tests.length,
      locale_breakdown,
      locale_breakdown_total: locale_breakdown.length,
      has_data: hasData
    };
  }

  async getDistribution(
    filters: AdminAnalyticsFilters,
    options: AdminAnalyticsDistributionOptions
  ): Promise<AdminAnalyticsDistributionResponse> {
    const tables = await this.resolveTableAvailability();
    const resolvedOptions = resolveAdminAnalyticsDistributionOptions(options);

    const [eventRows, stripeRows, publicationState] = await Promise.all([
      this.fetchEventByDimension(filters, tables, "CONCAT(ae.tenant_id, '::', ae.test_id)", "pair_key", {
        requireValue: true,
        orderBy: "sessions DESC"
      }),
      this.fetchStripeByDimension(filters, tables, "CONCAT(fp.tenant_id, '::', fp.test_id)", "pair_key", {
        requireValue: true,
        orderBy: "net_revenue_eur DESC"
      }),
      this.fetchPublicationState(filters, tables)
    ]);

    const pairMetrics = new Map<string, { tenant_id: string; test_id: string; sessions: number; purchases: number; net_revenue_eur: number }>();

    for (const row of eventRows) {
      const pairKey = toNullableString(row.pair_key);
      if (!pairKey || !pairKey.includes("::")) {
        continue;
      }

      const [tenantId, testId] = pairKey.split("::");
      if (!tenantId || !testId) {
        continue;
      }

      const current = pairMetrics.get(pairKey) ?? {
        tenant_id: tenantId,
        test_id: testId,
        sessions: 0,
        purchases: 0,
        net_revenue_eur: 0
      };

      current.sessions = toNumber(row.sessions);
      pairMetrics.set(pairKey, current);
    }

    for (const row of stripeRows) {
      const pairKey = toNullableString(row.pair_key);
      if (!pairKey || !pairKey.includes("::")) {
        continue;
      }

      const [tenantId, testId] = pairKey.split("::");
      if (!tenantId || !testId) {
        continue;
      }

      const current = pairMetrics.get(pairKey) ?? {
        tenant_id: tenantId,
        test_id: testId,
        sessions: 0,
        purchases: 0,
        net_revenue_eur: 0
      };

      current.purchases = toNumber(row.purchases);
      current.net_revenue_eur = roundCurrency(toNumber(row.net_revenue_eur));
      pairMetrics.set(pairKey, current);
    }

    const rowRevenue = new Map<string, number>();
    const colRevenue = new Map<string, number>();
    for (const metrics of pairMetrics.values()) {
      rowRevenue.set(metrics.tenant_id, (rowRevenue.get(metrics.tenant_id) ?? 0) + metrics.net_revenue_eur);
      colRevenue.set(metrics.test_id, (colRevenue.get(metrics.test_id) ?? 0) + metrics.net_revenue_eur);
    }

    for (const key of publicationState.keys()) {
      const [tenantId, testId] = key.split("::");
      if (!rowRevenue.has(tenantId)) {
        rowRevenue.set(tenantId, 0);
      }
      if (!colRevenue.has(testId)) {
        colRevenue.set(testId, 0);
      }
    }

    if (filters.tenant_id && !rowRevenue.has(filters.tenant_id)) {
      rowRevenue.set(filters.tenant_id, 0);
    }

    if (filters.test_id && !colRevenue.has(filters.test_id)) {
      colRevenue.set(filters.test_id, 0);
    }

    const row_order = [...rowRevenue.entries()]
      .sort((left, right) => {
        if (right[1] !== left[1]) {
          return right[1] - left[1];
        }

        return left[0].localeCompare(right[0]);
      })
      .slice(0, resolvedOptions.top_tenants)
      .map(([tenantId]) => tenantId);

    const column_order = [...colRevenue.entries()]
      .sort((left, right) => {
        if (right[1] !== left[1]) {
          return right[1] - left[1];
        }

        return left[0].localeCompare(right[0]);
      })
      .slice(0, resolvedOptions.top_tests)
      .map(([testId]) => testId);

    const rows: Record<string, { tenant_id: string; net_revenue_eur_7d: number; cells: Record<string, AdminAnalyticsDistributionCell> }> = {};
    const columns: Record<string, AdminAnalyticsDistributionColumn> = {};

    for (const testId of column_order) {
      columns[testId] = {
        test_id: testId,
        net_revenue_eur_7d: roundCurrency(colRevenue.get(testId) ?? 0)
      };
    }

    for (const tenantId of row_order) {
      const cells: Record<string, AdminAnalyticsDistributionCell> = {};

      for (const testId of column_order) {
        const pairKey = `${tenantId}::${testId}`;
        const metrics = pairMetrics.get(pairKey);
        const publication = publicationState.get(pairKey);
        const netRevenue = roundCurrency(metrics?.net_revenue_eur ?? 0);

        cells[testId] = {
          tenant_id: tenantId,
          test_id: testId,
          is_published: publication?.is_published ?? false,
          version_id: publication?.version_id ?? null,
          enabled: publication?.enabled ?? null,
          net_revenue_eur_7d: netRevenue,
          paid_conversion_7d: safeRatio(metrics?.purchases ?? 0, metrics?.sessions ?? 0)
        };
      }

      rows[tenantId] = {
        tenant_id: tenantId,
        net_revenue_eur_7d: roundCurrency(rowRevenue.get(tenantId) ?? 0),
        cells
      };
    }

    return {
      filters,
      generated_at_utc: generatedAtUtc(),
      top_tenants: resolvedOptions.top_tenants,
      top_tests: resolvedOptions.top_tests,
      row_order,
      column_order,
      rows,
      columns
    };
  }

  async getTraffic(
    filters: AdminAnalyticsFilters,
    options?: AdminAnalyticsTrafficOptions
  ): Promise<AdminAnalyticsTrafficResponse> {
    const tables = await this.resolveTableAvailability();
    const aggregate = await this.fetchOverviewAggregate(filters, tables);
    const resolvedOptions = resolveAdminAnalyticsTrafficOptions(options);

    const [byUtmSource, byUtmCampaign, byReferrer, byDeviceType, byCountry] = await Promise.all([
      this.fetchTrafficBreakdown(filters, tables, "utm_source", resolvedOptions.top_n),
      this.fetchTrafficBreakdown(filters, tables, "utm_campaign", resolvedOptions.top_n),
      this.fetchTrafficBreakdown(filters, tables, "referrer", resolvedOptions.top_n),
      this.fetchTrafficBreakdown(filters, tables, "device_type", resolvedOptions.top_n),
      this.fetchTrafficBreakdown(filters, tables, "country", resolvedOptions.top_n)
    ]);

    return {
      filters,
      generated_at_utc: generatedAtUtc(),
      top_n: resolvedOptions.top_n,
      kpis: buildOverviewKpis(aggregate),
      by_utm_source: byUtmSource,
      by_utm_campaign: byUtmCampaign,
      by_referrer: byReferrer,
      by_device_type: byDeviceType,
      by_country: byCountry
    };
  }

  async getRevenue(filters: AdminAnalyticsFilters): Promise<AdminAnalyticsRevenueResponse> {
    const tables = await this.resolveTableAvailability();

    const [aggregate, stripeDaily, byOfferRows, byTenantRows, byTestRows, internalPurchaseRow] = await Promise.all([
      this.fetchOverviewAggregate(filters, tables),
      this.fetchStripeDaily(filters, tables),
      this.fetchStripeByDimension(filters, tables, "CONCAT(COALESCE(fp.offer_key, ''), '::', COALESCE(fp.product_type, ''), '::', COALESCE(fp.pricing_variant, ''))", "offer_key_compound", {
        orderBy: "net_revenue_eur DESC",
        limit: DETAIL_ROWS_LIMIT
      }),
      this.fetchStripeByDimension(filters, tables, "fp.tenant_id", "tenant_id", {
        requireValue: true,
        orderBy: "net_revenue_eur DESC, fp.tenant_id ASC",
        limit: DETAIL_ROWS_LIMIT
      }),
      this.fetchStripeByDimension(filters, tables, "fp.test_id", "test_id", {
        requireValue: true,
        orderBy: "net_revenue_eur DESC, fp.test_id ASC",
        limit: DETAIL_ROWS_LIMIT
      }),
      tables.analytics_events
        ? this.queryRows<Record<string, unknown>>(
            `
              SELECT COUNT(*) AS internal_purchase_count
              FROM analytics_events ae
              ${buildContentDbEventFilterClause(filters).whereSql}
                AND ae.event_name = 'purchase_success'
            `,
            buildContentDbEventFilterClause(filters).params
          )
        : Promise.resolve([])
    ]);

    const dates = listDatesInclusive(filters.start, filters.end);
    const daily: AdminAnalyticsRevenueDailyRow[] = dates.map((date) => {
      const row = stripeDaily.get(date) ?? emptyStripeMetrics();
      return {
        date,
        gross_revenue_eur: row.gross_revenue_eur,
        refunds_eur: row.refunds_eur,
        disputes_fees_eur: row.disputes_eur,
        payment_fees_eur: row.payment_fees_eur,
        net_revenue_eur: row.net_revenue_eur
      };
    });

    const by_offer: AdminAnalyticsRevenueByOfferRow[] = byOfferRows.map((row) => {
      const rawCompound = toNullableString(row.offer_key_compound) ?? "::";
      const [offerKeyRaw, productTypeRaw, pricingVariantRaw] = rawCompound.split("::");
      const offerKey = offerKeyRaw?.trim() || "unknown";
      const productType = productTypeRaw?.trim() || null;
      const pricingVariant = pricingVariantRaw?.trim() || "default";

      return {
        offer_type: resolveOfferType(offerKey, productType),
        offer_key: offerKey,
        pricing_variant: pricingVariant,
        purchases: toNumber(row.purchases),
        gross_revenue_eur: roundCurrency(toNumber(row.gross_revenue_eur)),
        refunds_eur: roundCurrency(toNumber(row.refunds_eur)),
        disputes_fees_eur: roundCurrency(toNumber(row.disputes_eur)),
        payment_fees_eur: roundCurrency(toNumber(row.payment_fees_eur)),
        net_revenue_eur: roundCurrency(toNumber(row.net_revenue_eur))
      };
    });

    const by_tenant: AdminAnalyticsRevenueByTenantRow[] = byTenantRows
      .map((row) => {
        const tenantId = toNullableString(row.tenant_id)?.trim();
        if (!tenantId) {
          return null;
        }

        return {
          tenant_id: tenantId,
          purchases: toNumber(row.purchases),
          gross_revenue_eur: roundCurrency(toNumber(row.gross_revenue_eur)),
          refunds_eur: roundCurrency(toNumber(row.refunds_eur)),
          disputes_fees_eur: roundCurrency(toNumber(row.disputes_eur)),
          payment_fees_eur: roundCurrency(toNumber(row.payment_fees_eur)),
          net_revenue_eur: roundCurrency(toNumber(row.net_revenue_eur))
        };
      })
      .filter((row): row is AdminAnalyticsRevenueByTenantRow => row !== null);

    const by_test: AdminAnalyticsRevenueByTestRow[] = byTestRows
      .map((row) => {
        const testId = toNullableString(row.test_id)?.trim();
        if (!testId) {
          return null;
        }

        return {
          test_id: testId,
          purchases: toNumber(row.purchases),
          gross_revenue_eur: roundCurrency(toNumber(row.gross_revenue_eur)),
          refunds_eur: roundCurrency(toNumber(row.refunds_eur)),
          disputes_fees_eur: roundCurrency(toNumber(row.disputes_eur)),
          payment_fees_eur: roundCurrency(toNumber(row.payment_fees_eur)),
          net_revenue_eur: roundCurrency(toNumber(row.net_revenue_eur))
        };
      })
      .filter((row): row is AdminAnalyticsRevenueByTestRow => row !== null);

    const stripePurchaseCount = aggregate.purchases;
    const internalPurchaseCount = toNumber(internalPurchaseRow[0]?.internal_purchase_count);
    const purchaseDiff = internalPurchaseCount - stripePurchaseCount;

    const reconciliation: AdminAnalyticsRevenueReconciliation = {
      available: tables.analytics_events && tables.stripe_purchases,
      detail: tables.analytics_events && tables.stripe_purchases
        ? "Reconciliation compares analytics_events.purchase_success against stripe_purchases."
        : "analytics_events or stripe_purchases is unavailable; reconciliation is partial.",
      stripe_purchase_count: tables.stripe_purchases ? stripePurchaseCount : null,
      internal_purchase_count: tables.analytics_events ? internalPurchaseCount : null,
      purchase_count_diff: tables.analytics_events && tables.stripe_purchases ? purchaseDiff : null,
      purchase_count_diff_pct: tables.analytics_events && tables.stripe_purchases
        ? safeRatio(purchaseDiff, stripePurchaseCount || internalPurchaseCount || 1)
        : null,
      stripe_gross_revenue_eur: tables.stripe_purchases ? aggregate.gross_revenue_eur : null,
      internal_gross_revenue_eur: null,
      gross_revenue_diff_eur: null,
      gross_revenue_diff_pct: null
    };

    return {
      filters,
      generated_at_utc: generatedAtUtc(),
      kpis: buildOverviewKpis(aggregate),
      daily,
      by_offer,
      by_tenant,
      by_test,
      reconciliation
    };
  }

  async getAttribution(
    filters: AdminAnalyticsFilters,
    options: AdminAnalyticsAttributionOptions
  ): Promise<AdminAnalyticsAttributionResponse> {
    const tables = await this.resolveTableAvailability();
    const contentType = normalizeAttributionOption(options.content_type)?.toLowerCase() ?? null;
    const contentKey = normalizeAttributionOption(options.content_key);

    if (contentType && contentType !== "test") {
      return {
        filters,
        generated_at_utc: generatedAtUtc(),
        content_type: contentType,
        content_key: contentKey,
        grouped_by: filters.tenant_id ? "content" : "tenant",
        mix: [],
        rows: []
      };
    }

    const scopedFilters: AdminAnalyticsFilters = {
      ...filters,
      test_id: contentKey ?? filters.test_id
    };

    const [stripeRows, contentRows] = await Promise.all([
      this.fetchStripeByDimension(
        scopedFilters,
        tables,
        "CONCAT(COALESCE(fp.tenant_id, ''), '::', COALESCE(fp.test_id, ''), '::', COALESCE(NULLIF(fp.offer_key, ''), 'unknown'), '::', COALESCE(NULLIF(fp.pricing_variant, ''), 'unknown'))",
        "attribution_key",
        {
          orderBy: "net_revenue_eur DESC, purchases DESC",
          limit: DETAIL_ROWS_LIMIT
        }
      ),
      this.fetchEventByDimension(
        scopedFilters,
        tables,
        "CONCAT(COALESCE(ae.tenant_id, ''), '::', COALESCE(ae.test_id, ''))",
        "content_key_pair",
        {
          orderBy: "sessions DESC",
          limit: DETAIL_ROWS_LIMIT
        }
      )
    ]);

    const visitsByContentPair = new Map<string, number>();
    for (const row of contentRows) {
      const pairKey = toNullableString(row.content_key_pair)?.trim();
      if (!pairKey) {
        continue;
      }

      visitsByContentPair.set(pairKey, toNumber(row.sessions));
    }

    const rows: AdminAnalyticsAttributionRow[] = stripeRows
      .map((row) => {
        const rawKey = toNullableString(row.attribution_key)?.trim();
        if (!rawKey) {
          return null;
        }

        const [tenantIdRaw, testIdRaw, offerKeyRaw, pricingVariantRaw] = rawKey.split("::");
        const tenantId = tenantIdRaw?.trim() ?? "";
        const testId = testIdRaw?.trim() ?? "";
        if (!tenantId || !testId) {
          return null;
        }

        const visits = visitsByContentPair.get(`${tenantId}::${testId}`) ?? 0;
        const purchases = toNumber(row.purchases);

        return {
          tenant_id: tenantId,
          content_type: contentType ?? "test",
          content_key: testId,
          offer_key: offerKeyRaw?.trim() || "unknown",
          pricing_variant: pricingVariantRaw?.trim() || "default",
          purchases,
          visits,
          conversion: safeRatio(purchases, visits),
          gross_revenue_eur: roundCurrency(toNumber(row.gross_revenue_eur)),
          refunds_eur: roundCurrency(toNumber(row.refunds_eur)),
          disputes_fees_eur: roundCurrency(toNumber(row.disputes_eur)),
          payment_fees_eur: roundCurrency(toNumber(row.payment_fees_eur)),
          net_revenue_eur: roundCurrency(toNumber(row.net_revenue_eur))
        };
      })
      .filter((row): row is AdminAnalyticsAttributionRow => row !== null)
      .sort(
        (left, right) =>
          right.net_revenue_eur - left.net_revenue_eur ||
          right.purchases - left.purchases ||
          left.tenant_id.localeCompare(right.tenant_id) ||
          left.content_key.localeCompare(right.content_key) ||
          left.offer_key.localeCompare(right.offer_key)
      );

    const groupedBy: AdminAnalyticsAttributionGroupBy = filters.tenant_id ? "content" : "tenant";

    return {
      filters: scopedFilters,
      generated_at_utc: generatedAtUtc(),
      content_type: contentType ?? "test",
      content_key: contentKey,
      grouped_by: groupedBy,
      mix: buildAttributionMixRows(rows, groupedBy),
      rows
    };
  }

  async getDataHealth(filters: AdminAnalyticsFilters): Promise<AdminAnalyticsDataResponse> {
    const tables = await this.resolveTableAvailability();

    const [aggregate, freshness] = await Promise.all([
      this.fetchOverviewAggregate(filters, tables),
      this.fetchDataFreshnessRows(filters, tables)
    ]);

    const checks = this.buildDataHealthChecks(tables, aggregate, freshness);
    const status = combineHealthStatus([
      ...freshness.map((row) => row.status),
      ...checks.map((check) => check.status)
    ]);

    const dbtLastRun: AdminAnalyticsDataDbtRunMarker = {
      finished_at_utc: generatedAtUtc(),
      invocation_id: "content-db",
      model_count: null
    };

    const alerts: AdminAnalyticsDataAlertRow[] = [];

    return {
      filters,
      generated_at_utc: generatedAtUtc(),
      status,
      checks,
      freshness,
      alerts_available: false,
      alerts,
      dbt_last_run: dbtLastRun
    };
  }
}

export const createContentDbAdminAnalyticsProvider = (): AdminAnalyticsProvider => {
  return new ContentDbAdminAnalyticsProvider();
};

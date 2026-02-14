import {
  formatDateYYYYMMDD,
  getDefaultAnalyticsDateRange,
  parseDateYYYYMMDD
} from "../admin/analytics_dates";

export const ADMIN_ANALYTICS_LOCALES = ["all", "en", "es", "pt-BR"] as const;
export const ADMIN_ANALYTICS_DEVICE_TYPES = ["all", "desktop", "mobile", "tablet"] as const;

const LOCALE_SET = new Set<string>(ADMIN_ANALYTICS_LOCALES);
const DEVICE_TYPE_SET = new Set<string>(ADMIN_ANALYTICS_DEVICE_TYPES);
const MAX_OPTIONAL_FILTER_LENGTH = 120;

const hasControlCharacters = (value: string): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) {
      return true;
    }
  }

  return false;
};

export type AdminAnalyticsLocale = (typeof ADMIN_ANALYTICS_LOCALES)[number];
export type AdminAnalyticsDeviceType = (typeof ADMIN_ANALYTICS_DEVICE_TYPES)[number];

export type AdminAnalyticsFilters = {
  start: string;
  end: string;
  tenant_id: string | null;
  test_id: string | null;
  locale: AdminAnalyticsLocale;
  device_type: AdminAnalyticsDeviceType;
  utm_source: string | null;
};

export type AdminAnalyticsValidationIssue = {
  field:
    | "start"
    | "end"
    | "tenant_id"
    | "test_id"
    | "locale"
    | "device_type"
    | "utm_source"
    | "params";
  message: string;
};

export type AdminAnalyticsFilterParseResult =
  | { ok: true; value: AdminAnalyticsFilters }
  | { ok: false; errors: AdminAnalyticsValidationIssue[] };

export type KpiCardUnit = "count" | "currency_eur" | "ratio" | "percent";

export type KpiCard = {
  key: string;
  label: string;
  value: number;
  unit: KpiCardUnit;
  delta: number | null;
};

export type TimeseriesPoint = {
  date: string;
  value: number;
};

export type FunnelStep = {
  key: string;
  label: string;
  count: number;
  conversion_rate: number | null;
};

export type TableCellValue = string | number | boolean | null;
export type TableRow = Record<string, TableCellValue>;

export type AdminAnalyticsTestsRow = TableRow & {
  test_id: string;
  title: string;
  visits: number;
  test_starts: number;
  test_completions: number;
  purchase_success_count: number;
  purchase_conversion: number;
  revenue_eur: number;
};

export type AdminAnalyticsTenantsRow = TableRow & {
  tenant_id: string;
  sessions: number;
  test_starts: number;
  test_completions: number;
  purchases: number;
  paid_conversion: number;
  net_revenue_eur: number;
  refunds_eur: number;
  top_test_id: string | null;
  last_activity_date: string | null;
};

export type AdminAnalyticsTenantTopTestRow = TableRow & {
  test_id: string;
  sessions: number;
  test_starts: number;
  test_completions: number;
  purchases: number;
  paid_conversion: number;
  net_revenue_eur: number;
  refunds_eur: number;
};

export type AdminAnalyticsTenantLocaleRow = TableRow & {
  locale: string;
  sessions: number;
  test_starts: number;
  test_completions: number;
  purchases: number;
  paid_conversion: number;
  net_revenue_eur: number;
  refunds_eur: number;
};

export type AdminAnalyticsDistributionRow = TableRow & {
  tenant_id: string;
  test_id: string;
  visits: number;
  test_completions: number;
  purchase_success_count: number;
  revenue_eur: number;
};

export type AdminAnalyticsBreakdownRow = TableRow & {
  segment: string;
  visits: number;
  unique_visitors: number;
  test_starts: number;
  test_completions: number;
  purchase_success_count: number;
  purchase_conversion: number;
};

export type AdminAnalyticsRevenueDailyRow = TableRow & {
  date: string;
  gross_revenue_eur: number;
  refunds_eur: number;
  disputes_fees_eur: number;
  payment_fees_eur: number;
  net_revenue_eur: number;
};

export type AdminAnalyticsRevenueByOfferRow = TableRow & {
  offer_type: "single" | "pack_5" | "pack_10";
  purchases: number;
  gross_revenue_eur: number;
  net_revenue_eur: number;
};

export type AdminAnalyticsDataHealthStatus = "ok" | "warn" | "error";

export type AdminAnalyticsDataHealthCheck = {
  key: string;
  label: string;
  status: AdminAnalyticsDataHealthStatus;
  detail: string;
  last_updated_utc: string | null;
};

export type AdminAnalyticsDataFreshnessRow = TableRow & {
  dataset: string;
  table: string;
  last_loaded_utc: string;
  lag_minutes: number;
  status: AdminAnalyticsDataHealthStatus;
};

export type AdminAnalyticsOverviewTopTestRow = TableRow & {
  test_id: string;
  net_revenue_eur: number;
  purchase_conversion: number;
  purchases: number;
};

export type AdminAnalyticsOverviewTopTenantRow = TableRow & {
  tenant_id: string;
  net_revenue_eur: number;
  purchases: number;
};

export type AdminAnalyticsOverviewFreshnessRow = TableRow & {
  table: string;
  max_date: string | null;
  available: boolean;
};

export type AdminAnalyticsOverviewAlertRow = TableRow & {
  detected_at_utc: string;
  alert_name: string;
  severity: string;
  tenant_id: string | null;
  metric_value: number | null;
  threshold_value: number | null;
};

export type AdminAnalyticsOverviewResponse = {
  filters: AdminAnalyticsFilters;
  generated_at_utc: string;
  kpis: KpiCard[];
  funnel: FunnelStep[];
  visits_timeseries: TimeseriesPoint[];
  revenue_timeseries: TimeseriesPoint[];
  top_tests: AdminAnalyticsOverviewTopTestRow[];
  top_tenants: AdminAnalyticsOverviewTopTenantRow[];
  data_freshness: AdminAnalyticsOverviewFreshnessRow[];
  alerts_available: boolean;
  alerts: AdminAnalyticsOverviewAlertRow[];
};

export type AdminAnalyticsTestsResponse = {
  filters: AdminAnalyticsFilters;
  generated_at_utc: string;
  rows: AdminAnalyticsTestsRow[];
};

export type AdminAnalyticsTestDetailResponse = {
  filters: AdminAnalyticsFilters;
  generated_at_utc: string;
  test_id: string;
  kpis: KpiCard[];
  funnel: FunnelStep[];
  visits_timeseries: TimeseriesPoint[];
  revenue_timeseries: TimeseriesPoint[];
  locale_breakdown: AdminAnalyticsBreakdownRow[];
  device_breakdown: AdminAnalyticsBreakdownRow[];
};

export type AdminAnalyticsTenantsResponse = {
  filters: AdminAnalyticsFilters;
  generated_at_utc: string;
  rows: AdminAnalyticsTenantsRow[];
  total_rows: number;
};

export type AdminAnalyticsTenantDetailResponse = {
  filters: AdminAnalyticsFilters;
  generated_at_utc: string;
  tenant_id: string;
  kpis: KpiCard[];
  funnel: FunnelStep[];
  sessions_timeseries: TimeseriesPoint[];
  revenue_timeseries: TimeseriesPoint[];
  top_tests: AdminAnalyticsTenantTopTestRow[];
  top_tests_total: number;
  locale_breakdown: AdminAnalyticsTenantLocaleRow[];
  locale_breakdown_total: number;
  has_data: boolean;
};

export type AdminAnalyticsDistributionResponse = {
  filters: AdminAnalyticsFilters;
  generated_at_utc: string;
  rows: AdminAnalyticsDistributionRow[];
};

export type AdminAnalyticsTrafficResponse = {
  filters: AdminAnalyticsFilters;
  generated_at_utc: string;
  kpis: KpiCard[];
  by_utm_source: AdminAnalyticsBreakdownRow[];
  by_device_type: AdminAnalyticsBreakdownRow[];
  by_locale: AdminAnalyticsBreakdownRow[];
};

export type AdminAnalyticsRevenueResponse = {
  filters: AdminAnalyticsFilters;
  generated_at_utc: string;
  kpis: KpiCard[];
  daily: AdminAnalyticsRevenueDailyRow[];
  by_offer: AdminAnalyticsRevenueByOfferRow[];
};

export type AdminAnalyticsDataResponse = {
  filters: AdminAnalyticsFilters;
  generated_at_utc: string;
  checks: AdminAnalyticsDataHealthCheck[];
  freshness: AdminAnalyticsDataFreshnessRow[];
};

const normalizeOptionalFilter = (
  field: "tenant_id" | "test_id" | "utm_source",
  value: string | null,
  errors: AdminAnalyticsValidationIssue[]
): string | null => {
  if (value === null) {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  if (normalized.length > MAX_OPTIONAL_FILTER_LENGTH) {
    errors.push({
      field,
      message: `must be ${MAX_OPTIONAL_FILTER_LENGTH} characters or fewer`
    });
    return null;
  }

  if (hasControlCharacters(normalized)) {
    errors.push({
      field,
      message: "contains control characters"
    });
    return null;
  }

  return normalized;
};

const parseDateRange = (
  searchParams: URLSearchParams,
  now: Date,
  errors: AdminAnalyticsValidationIssue[]
): { start: string; end: string } => {
  const defaults = getDefaultAnalyticsDateRange(now);
  const startRaw = searchParams.get("start");
  const endRaw = searchParams.get("end");

  if (startRaw === null && endRaw === null) {
    return defaults;
  }

  if (!startRaw || !endRaw) {
    errors.push({
      field: "params",
      message: "start and end must both be provided when either one is set"
    });
    return defaults;
  }

  const startDate = parseDateYYYYMMDD(startRaw);
  const endDate = parseDateYYYYMMDD(endRaw);

  if (!startDate) {
    errors.push({
      field: "start",
      message: "must match YYYY-MM-DD"
    });
  }

  if (!endDate) {
    errors.push({
      field: "end",
      message: "must match YYYY-MM-DD"
    });
  }

  if (!startDate || !endDate) {
    return defaults;
  }

  if (startDate.getTime() > endDate.getTime()) {
    errors.push({
      field: "params",
      message: "start must be on or before end"
    });
    return defaults;
  }

  return {
    start: formatDateYYYYMMDD(startDate),
    end: formatDateYYYYMMDD(endDate)
  };
};

const parseLocale = (
  value: string | null,
  errors: AdminAnalyticsValidationIssue[]
): AdminAnalyticsLocale => {
  if (value === null || value.trim().length === 0) {
    return "all";
  }

  if (!LOCALE_SET.has(value)) {
    errors.push({
      field: "locale",
      message: `must be one of ${ADMIN_ANALYTICS_LOCALES.join(", ")}`
    });
    return "all";
  }

  return value as AdminAnalyticsLocale;
};

const parseDeviceType = (
  value: string | null,
  errors: AdminAnalyticsValidationIssue[]
): AdminAnalyticsDeviceType => {
  if (value === null || value.trim().length === 0) {
    return "all";
  }

  if (!DEVICE_TYPE_SET.has(value)) {
    errors.push({
      field: "device_type",
      message: `must be one of ${ADMIN_ANALYTICS_DEVICE_TYPES.join(", ")}`
    });
    return "all";
  }

  return value as AdminAnalyticsDeviceType;
};

export const parseAdminAnalyticsFilters = (
  searchParams: URLSearchParams,
  now: Date = new Date()
): AdminAnalyticsFilterParseResult => {
  const errors: AdminAnalyticsValidationIssue[] = [];
  const dateRange = parseDateRange(searchParams, now, errors);

  const filters: AdminAnalyticsFilters = {
    start: dateRange.start,
    end: dateRange.end,
    tenant_id: normalizeOptionalFilter("tenant_id", searchParams.get("tenant_id"), errors),
    test_id: normalizeOptionalFilter("test_id", searchParams.get("test_id"), errors),
    locale: parseLocale(searchParams.get("locale"), errors),
    device_type: parseDeviceType(searchParams.get("device_type"), errors),
    utm_source: normalizeOptionalFilter("utm_source", searchParams.get("utm_source"), errors)
  };

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: filters
  };
};

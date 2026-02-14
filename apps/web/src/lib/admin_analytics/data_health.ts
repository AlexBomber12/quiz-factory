import type { AdminAnalyticsDataHealthStatus } from "./types";

export type AdminAnalyticsFreshnessThresholds = {
  warn_after_minutes: number;
  error_after_minutes: number;
};

const DEFAULT_THRESHOLDS: AdminAnalyticsFreshnessThresholds = {
  warn_after_minutes: 180,
  error_after_minutes: 360
};

const FRESHNESS_THRESHOLD_OVERRIDES: Record<string, AdminAnalyticsFreshnessThresholds> = {
  "marts.mart_funnel_daily": {
    warn_after_minutes: 26 * 60,
    error_after_minutes: 52 * 60
  },
  "marts.mart_pnl_daily": {
    warn_after_minutes: 30 * 60,
    error_after_minutes: 60 * 60
  },
  "raw_stripe.purchases": {
    warn_after_minutes: 90,
    error_after_minutes: 180
  }
};

const thresholdKey = (dataset: string, table: string): string => {
  return `${dataset}.${table}`;
};

export const resolveFreshnessThresholds = (
  dataset: string,
  table: string
): AdminAnalyticsFreshnessThresholds => {
  return FRESHNESS_THRESHOLD_OVERRIDES[thresholdKey(dataset, table)] ?? DEFAULT_THRESHOLDS;
};

export const evaluateFreshnessStatus = (
  lagMinutes: number | null,
  thresholds: AdminAnalyticsFreshnessThresholds
): AdminAnalyticsDataHealthStatus => {
  if (lagMinutes === null || !Number.isFinite(lagMinutes) || lagMinutes < 0) {
    return "error";
  }

  if (lagMinutes >= thresholds.error_after_minutes) {
    return "error";
  }

  if (lagMinutes >= thresholds.warn_after_minutes) {
    return "warn";
  }

  return "ok";
};

export const combineHealthStatus = (
  statuses: readonly AdminAnalyticsDataHealthStatus[]
): AdminAnalyticsDataHealthStatus => {
  if (statuses.includes("error")) {
    return "error";
  }

  if (statuses.includes("warn")) {
    return "warn";
  }

  return "ok";
};

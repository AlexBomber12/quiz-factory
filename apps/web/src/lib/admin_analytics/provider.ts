import type {
  AdminAnalyticsAttributionOptions,
  AdminAnalyticsAttributionResponse,
  AdminAnalyticsDataResponse,
  AdminAnalyticsDistributionOptions,
  AdminAnalyticsDistributionResponse,
  AdminAnalyticsFilters,
  AdminAnalyticsOverviewResponse,
  AdminAnalyticsRevenueResponse,
  AdminAnalyticsTenantDetailResponse,
  AdminAnalyticsTenantsResponse,
  AdminAnalyticsTestDetailResponse,
  AdminAnalyticsTestsResponse,
  AdminAnalyticsTrafficOptions,
  AdminAnalyticsTrafficResponse
} from "./types";
import { createBigQueryAdminAnalyticsProvider } from "./providers/bigquery";
import { createContentDbAdminAnalyticsProvider } from "./providers/content_db";
import { createMockAdminAnalyticsProvider } from "./providers/mock";
import { env } from "@/lib/env";

export interface AdminAnalyticsProvider {
  getOverview(filters: AdminAnalyticsFilters): Promise<AdminAnalyticsOverviewResponse>;
  getTests(filters: AdminAnalyticsFilters): Promise<AdminAnalyticsTestsResponse>;
  getTestDetail(
    testId: string,
    filters: AdminAnalyticsFilters
  ): Promise<AdminAnalyticsTestDetailResponse>;
  getTenants(filters: AdminAnalyticsFilters): Promise<AdminAnalyticsTenantsResponse>;
  getTenantDetail(
    tenantId: string,
    filters: AdminAnalyticsFilters
  ): Promise<AdminAnalyticsTenantDetailResponse>;
  getDistribution(
    filters: AdminAnalyticsFilters,
    options: AdminAnalyticsDistributionOptions
  ): Promise<AdminAnalyticsDistributionResponse>;
  getTraffic(
    filters: AdminAnalyticsFilters,
    options?: AdminAnalyticsTrafficOptions
  ): Promise<AdminAnalyticsTrafficResponse>;
  getRevenue(filters: AdminAnalyticsFilters): Promise<AdminAnalyticsRevenueResponse>;
  getAttribution(
    filters: AdminAnalyticsFilters,
    options: AdminAnalyticsAttributionOptions
  ): Promise<AdminAnalyticsAttributionResponse>;
  getDataHealth(filters: AdminAnalyticsFilters): Promise<AdminAnalyticsDataResponse>;
}

export class AdminAnalyticsNotImplementedError extends Error {
  code: "not_implemented";
  status: number;

  constructor(message: string) {
    super(message);
    this.name = "AdminAnalyticsNotImplementedError";
    this.code = "not_implemented";
    this.status = 501;
  }
}

export type AdminAnalyticsProviderMode = "mock" | "bigquery" | "content_db";
type ProviderEnv = Record<string, string | undefined>;

let cachedProvider: AdminAnalyticsProvider | null = null;
let cachedProviderMode: AdminAnalyticsProviderMode | null = null;

const loggedWarnings = new Set<string>();

const isNonEmptyEnv = (value: string | undefined): boolean => {
  return typeof value === "string" && value.trim().length > 0;
};

const hasBigQueryConfig = (values: ProviderEnv = env as ProviderEnv): boolean => {
  return (
    isNonEmptyEnv(values.BIGQUERY_PROJECT_ID) &&
    isNonEmptyEnv(values.BIGQUERY_STRIPE_DATASET) &&
    isNonEmptyEnv(values.BIGQUERY_RAW_COSTS_DATASET) &&
    isNonEmptyEnv(values.BIGQUERY_TMP_DATASET)
  );
};

const hasContentDbConfig = (values: ProviderEnv = env as ProviderEnv): boolean => {
  return isNonEmptyEnv(values.CONTENT_DATABASE_URL);
};

const logProviderSelectionWarning = (key: string, message: string): void => {
  if (loggedWarnings.has(key)) {
    return;
  }

  loggedWarnings.add(key);
  console.warn(`[admin_analytics.provider] ${message}`);
};

export const resolveAdminAnalyticsProviderMode = (
  values: ProviderEnv = env as ProviderEnv
): AdminAnalyticsProviderMode => {
  const override = values.ADMIN_ANALYTICS_MODE?.trim().toLowerCase() ?? "";

  if (override.length > 0) {
    if (override === "mock") {
      return "mock";
    }

    if (override === "bigquery") {
      if (hasBigQueryConfig(values)) {
        return "bigquery";
      }

      logProviderSelectionWarning(
        "override-bigquery-missing-env",
        "ADMIN_ANALYTICS_MODE=bigquery requested, but required BigQuery env vars are missing. Falling back to mock provider."
      );
      return "mock";
    }

    if (override === "content_db") {
      if (hasContentDbConfig(values)) {
        return "content_db";
      }

      logProviderSelectionWarning(
        "override-content-db-missing-env",
        "ADMIN_ANALYTICS_MODE=content_db requested, but CONTENT_DATABASE_URL is missing. Falling back to mock provider."
      );
      return "mock";
    }

    logProviderSelectionWarning(
      `override-invalid-${override}`,
      `Unsupported ADMIN_ANALYTICS_MODE=${override}. Falling back to mock provider.`
    );
    return "mock";
  }

  if (hasBigQueryConfig(values)) {
    return "bigquery";
  }

  if (hasContentDbConfig(values)) {
    return "content_db";
  }

  return "mock";
};

export const getAdminAnalyticsProvider = (): AdminAnalyticsProvider => {
  const mode = resolveAdminAnalyticsProviderMode();
  if (cachedProvider && cachedProviderMode === mode) {
    return cachedProvider;
  }

  switch (mode) {
    case "bigquery":
      cachedProvider = createBigQueryAdminAnalyticsProvider();
      break;
    case "content_db":
      cachedProvider = createContentDbAdminAnalyticsProvider();
      break;
    case "mock":
    default:
      cachedProvider = createMockAdminAnalyticsProvider();
      break;
  }

  cachedProviderMode = mode;
  return cachedProvider;
};

export const __resetAdminAnalyticsProviderForTests = (): void => {
  cachedProvider = null;
  cachedProviderMode = null;
  loggedWarnings.clear();
};

export const isAdminAnalyticsNotImplementedError = (
  value: unknown
): value is AdminAnalyticsNotImplementedError => {
  return value instanceof AdminAnalyticsNotImplementedError;
};

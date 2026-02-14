import type {
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
  AdminAnalyticsTrafficResponse
} from "./types";
import { createBigQueryAdminAnalyticsProvider } from "./providers/bigquery";
import { createMockAdminAnalyticsProvider } from "./providers/mock";

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
  getTraffic(filters: AdminAnalyticsFilters): Promise<AdminAnalyticsTrafficResponse>;
  getRevenue(filters: AdminAnalyticsFilters): Promise<AdminAnalyticsRevenueResponse>;
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

let cachedProvider: AdminAnalyticsProvider | null = null;
let cachedProviderMode: "mock" | "bigquery" | null = null;

const isNonEmptyEnv = (value: string | undefined): boolean => {
  return typeof value === "string" && value.trim().length > 0;
};

const shouldUseBigQueryProvider = (): boolean => {
  return (
    isNonEmptyEnv(process.env.BIGQUERY_PROJECT_ID) &&
    isNonEmptyEnv(process.env.BIGQUERY_STRIPE_DATASET) &&
    isNonEmptyEnv(process.env.BIGQUERY_RAW_COSTS_DATASET) &&
    isNonEmptyEnv(process.env.BIGQUERY_TMP_DATASET)
  );
};

export const getAdminAnalyticsProvider = (): AdminAnalyticsProvider => {
  const mode: "mock" | "bigquery" = shouldUseBigQueryProvider() ? "bigquery" : "mock";
  if (cachedProvider && cachedProviderMode === mode) {
    return cachedProvider;
  }

  cachedProvider = mode === "bigquery"
    ? createBigQueryAdminAnalyticsProvider()
    : createMockAdminAnalyticsProvider();
  cachedProviderMode = mode;
  return cachedProvider;
};

export const isAdminAnalyticsNotImplementedError = (
  value: unknown
): value is AdminAnalyticsNotImplementedError => {
  return value instanceof AdminAnalyticsNotImplementedError;
};

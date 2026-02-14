import { BigQuery } from "@google-cloud/bigquery";

import {
  AdminAnalyticsNotImplementedError,
  type AdminAnalyticsProvider
} from "../provider";
import type {
  AdminAnalyticsDataResponse,
  AdminAnalyticsDistributionResponse,
  AdminAnalyticsFilters,
  AdminAnalyticsOverviewResponse,
  AdminAnalyticsRevenueResponse,
  AdminAnalyticsTenantDetailResponse,
  AdminAnalyticsTenantsResponse,
  AdminAnalyticsTestDetailResponse,
  AdminAnalyticsTestsResponse,
  AdminAnalyticsTrafficResponse
} from "../types";

type BigQueryAdminAnalyticsDatasets = {
  stripe: string;
  rawCosts: string;
  tmp: string;
};

class BigQueryAdminAnalyticsProvider implements AdminAnalyticsProvider {
  constructor(
    private readonly bigquery: BigQuery,
    private readonly projectId: string,
    private readonly datasets: BigQueryAdminAnalyticsDatasets
  ) {}

  private notImplemented(method: string): AdminAnalyticsNotImplementedError {
    return new AdminAnalyticsNotImplementedError(
      `BigQuery admin analytics method '${method}' is not implemented (project=${this.projectId}, datasets=${JSON.stringify(this.datasets)}).`
    );
  }

  async getOverview(filters: AdminAnalyticsFilters): Promise<AdminAnalyticsOverviewResponse> {
    void filters;
    void this.bigquery;
    throw this.notImplemented("getOverview");
  }

  async getTests(filters: AdminAnalyticsFilters): Promise<AdminAnalyticsTestsResponse> {
    void filters;
    throw this.notImplemented("getTests");
  }

  async getTestDetail(
    testId: string,
    filters: AdminAnalyticsFilters
  ): Promise<AdminAnalyticsTestDetailResponse> {
    void testId;
    void filters;
    throw this.notImplemented("getTestDetail");
  }

  async getTenants(filters: AdminAnalyticsFilters): Promise<AdminAnalyticsTenantsResponse> {
    void filters;
    throw this.notImplemented("getTenants");
  }

  async getTenantDetail(
    tenantId: string,
    filters: AdminAnalyticsFilters
  ): Promise<AdminAnalyticsTenantDetailResponse> {
    void tenantId;
    void filters;
    throw this.notImplemented("getTenantDetail");
  }

  async getDistribution(filters: AdminAnalyticsFilters): Promise<AdminAnalyticsDistributionResponse> {
    void filters;
    throw this.notImplemented("getDistribution");
  }

  async getTraffic(filters: AdminAnalyticsFilters): Promise<AdminAnalyticsTrafficResponse> {
    void filters;
    throw this.notImplemented("getTraffic");
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

export const createBigQueryAdminAnalyticsProvider = (): AdminAnalyticsProvider => {
  const projectId = readRequiredEnv("BIGQUERY_PROJECT_ID");
  const datasets: BigQueryAdminAnalyticsDatasets = {
    stripe: readRequiredEnv("BIGQUERY_STRIPE_DATASET"),
    rawCosts: readRequiredEnv("BIGQUERY_RAW_COSTS_DATASET"),
    tmp: readRequiredEnv("BIGQUERY_TMP_DATASET")
  };
  const bigquery = new BigQuery({ projectId });
  return new BigQueryAdminAnalyticsProvider(bigquery, projectId, datasets);
};

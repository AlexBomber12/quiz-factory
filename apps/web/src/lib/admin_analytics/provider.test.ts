import { afterEach, describe, expect, it, vi } from "vitest";

import {
  __resetAdminAnalyticsProviderForTests,
  resolveAdminAnalyticsProviderMode
} from "./provider";

type ProviderEnv = Record<string, string | undefined>;

const baseEnv = (): ProviderEnv => ({
  NODE_ENV: "test",
  BIGQUERY_PROJECT_ID: "",
  BIGQUERY_STRIPE_DATASET: "",
  BIGQUERY_RAW_COSTS_DATASET: "",
  BIGQUERY_TMP_DATASET: "",
  CONTENT_DATABASE_URL: "",
  ADMIN_ANALYTICS_MODE: ""
});

afterEach(() => {
  __resetAdminAnalyticsProviderForTests();
  vi.restoreAllMocks();
});

describe("resolveAdminAnalyticsProviderMode", () => {
  it("defaults to mock when no analytics backends are configured", () => {
    expect(resolveAdminAnalyticsProviderMode(baseEnv())).toBe("mock");
  });

  it("selects bigquery when all BigQuery env vars are set", () => {
    const env = baseEnv();
    env.BIGQUERY_PROJECT_ID = "quiz-factory-analytics";
    env.BIGQUERY_STRIPE_DATASET = "raw_stripe";
    env.BIGQUERY_RAW_COSTS_DATASET = "raw_costs";
    env.BIGQUERY_TMP_DATASET = "tmp";

    expect(resolveAdminAnalyticsProviderMode(env)).toBe("bigquery");
  });

  it("selects content_db when BigQuery is missing and CONTENT_DATABASE_URL is present", () => {
    const env = baseEnv();
    env.CONTENT_DATABASE_URL = "postgres://localhost:5432/content";

    expect(resolveAdminAnalyticsProviderMode(env)).toBe("content_db");
  });

  it("honors ADMIN_ANALYTICS_MODE=content_db override", () => {
    const env = baseEnv();
    env.ADMIN_ANALYTICS_MODE = "content_db";
    env.CONTENT_DATABASE_URL = "postgres://localhost:5432/content";
    env.BIGQUERY_PROJECT_ID = "quiz-factory-analytics";
    env.BIGQUERY_STRIPE_DATASET = "raw_stripe";
    env.BIGQUERY_RAW_COSTS_DATASET = "raw_costs";
    env.BIGQUERY_TMP_DATASET = "tmp";

    expect(resolveAdminAnalyticsProviderMode(env)).toBe("content_db");
  });

  it("falls back to mock when ADMIN_ANALYTICS_MODE=bigquery and required env vars are missing", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const env = baseEnv();
    env.ADMIN_ANALYTICS_MODE = "bigquery";

    expect(resolveAdminAnalyticsProviderMode(env)).toBe("mock");
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("falls back to mock when ADMIN_ANALYTICS_MODE=content_db and CONTENT_DATABASE_URL is missing", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const env = baseEnv();
    env.ADMIN_ANALYTICS_MODE = "content_db";

    expect(resolveAdminAnalyticsProviderMode(env)).toBe("mock");
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const BIGQUERY_ENV_KEYS = [
  "BIGQUERY_PROJECT_ID",
  "BIGQUERY_STRIPE_DATASET",
  "BIGQUERY_RAW_COSTS_DATASET",
  "BIGQUERY_TMP_DATASET"
] as const;

const originalEnv: Record<(typeof BIGQUERY_ENV_KEYS)[number], string | undefined> = {
  BIGQUERY_PROJECT_ID: process.env.BIGQUERY_PROJECT_ID,
  BIGQUERY_STRIPE_DATASET: process.env.BIGQUERY_STRIPE_DATASET,
  BIGQUERY_RAW_COSTS_DATASET: process.env.BIGQUERY_RAW_COSTS_DATASET,
  BIGQUERY_TMP_DATASET: process.env.BIGQUERY_TMP_DATASET
};

const clearBigQueryEnv = () => {
  for (const key of BIGQUERY_ENV_KEYS) {
    delete process.env[key];
  }
};

const restoreBigQueryEnv = () => {
  for (const key of BIGQUERY_ENV_KEYS) {
    const value = originalEnv[key];
    if (typeof value === "string") {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }
  }
};

describe("GET /api/admin/analytics/data", () => {
  beforeEach(() => {
    clearBigQueryEnv();
    vi.resetModules();
  });

  afterEach(() => {
    restoreBigQueryEnv();
    vi.resetModules();
  });

  it("returns the expected response shape", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost:3000/api/admin/analytics/data?start=2026-02-01&end=2026-02-07")
    );

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(payload).toMatchObject({
      filters: {
        start: "2026-02-01",
        end: "2026-02-07"
      },
      generated_at_utc: expect.any(String),
      status: expect.any(String),
      checks: expect.any(Array),
      freshness: expect.any(Array),
      alerts_available: expect.any(Boolean),
      alerts: expect.any(Array),
      dbt_last_run: {
        finished_at_utc: expect.any(String)
      }
    });

    expect(payload.freshness.length).toBeGreaterThan(0);
    expect(payload.freshness[0]).toMatchObject({
      dataset: expect.any(String),
      table: expect.any(String),
      lag_minutes: expect.any(Number),
      warn_after_minutes: expect.any(Number),
      error_after_minutes: expect.any(Number),
      status: expect.any(String)
    });
    expect(payload.checks[0]).toMatchObject({
      key: expect.any(String),
      label: expect.any(String),
      status: expect.any(String),
      detail: expect.any(String)
    });
  });
});

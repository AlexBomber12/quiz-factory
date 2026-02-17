import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseAttributionOptions } from "./route";

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

describe("parseAttributionOptions", () => {
  it("returns null options when omitted", () => {
    const parsed = parseAttributionOptions(new URLSearchParams());

    expect(parsed).toEqual({
      ok: true,
      value: {
        content_type: null,
        content_key: null
      }
    });
  });

  it("accepts valid content_type/content_key options", () => {
    const parsed = parseAttributionOptions(
      new URLSearchParams({
        content_type: "TEST",
        content_key: "test-focus-rhythm"
      })
    );

    expect(parsed).toEqual({
      ok: true,
      value: {
        content_type: "test",
        content_key: "test-focus-rhythm"
      }
    });
  });

  it("rejects invalid content_type and malformed content_key", () => {
    const parsed = parseAttributionOptions(
      new URLSearchParams({
        content_type: "video",
        content_key: "bad\u0000value"
      })
    );

    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      return;
    }

    expect(parsed.errors).toEqual([
      {
        field: "content_key",
        message: "contains control characters"
      },
      {
        field: "content_type",
        message: "must be test when provided"
      }
    ]);
  });
});

describe("GET /api/admin/analytics/attribution", () => {
  beforeEach(() => {
    clearBigQueryEnv();
    vi.resetModules();
  });

  afterEach(() => {
    restoreBigQueryEnv();
    vi.resetModules();
  });

  it("returns attribution payload shape", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request(
        "http://localhost:3000/api/admin/analytics/attribution?start=2026-02-01&end=2026-02-07&content_type=test"
      )
    );

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(payload).toMatchObject({
      filters: {
        start: "2026-02-01",
        end: "2026-02-07"
      },
      generated_at_utc: expect.any(String),
      content_type: "test",
      content_key: null,
      grouped_by: expect.stringMatching(/^(tenant|content)$/),
      mix: expect.any(Array),
      rows: expect.any(Array)
    });

    expect(payload.rows.length).toBeGreaterThan(0);
    expect(payload.rows[0]).toMatchObject({
      tenant_id: expect.any(String),
      content_type: "test",
      content_key: expect.any(String),
      offer_key: expect.any(String),
      pricing_variant: expect.any(String),
      purchases: expect.any(Number),
      visits: expect.any(Number),
      conversion: expect.any(Number),
      gross_revenue_eur: expect.any(Number),
      net_revenue_eur: expect.any(Number)
    });
  });
});

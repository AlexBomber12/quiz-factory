import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StripeAnalyticsStore } from "../../../../lib/stripe/store";

const mocks = vi.hoisted(() => ({
  createStripeBigQueryStore: vi.fn(),
  createStripeContentDbStore: vi.fn()
}));

vi.mock("../../../../lib/stripe/bigquery", () => ({
  createStripeBigQueryStore: mocks.createStripeBigQueryStore
}));

vi.mock("../../../../lib/stripe/content_db", () => ({
  createStripeContentDbStore: mocks.createStripeContentDbStore
}));

const BIGQUERY_ENV_KEYS = [
  "BIGQUERY_PROJECT_ID",
  "GOOGLE_CLOUD_PROJECT",
  "GCP_PROJECT",
  "BIGQUERY_STRIPE_DATASET"
] as const;

const originalBigQueryEnv: Record<(typeof BIGQUERY_ENV_KEYS)[number], string | undefined> = {
  BIGQUERY_PROJECT_ID: process.env.BIGQUERY_PROJECT_ID,
  GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
  GCP_PROJECT: process.env.GCP_PROJECT,
  BIGQUERY_STRIPE_DATASET: process.env.BIGQUERY_STRIPE_DATASET
};

const clearBigQueryEnv = (): void => {
  for (const key of BIGQUERY_ENV_KEYS) {
    delete process.env[key];
  }
};

const restoreBigQueryEnv = (): void => {
  for (const key of BIGQUERY_ENV_KEYS) {
    const value = originalBigQueryEnv[key];
    if (typeof value === "string") {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }
  }
};

const createStoreStub = (): StripeAnalyticsStore => ({
  recordWebhookEvent: vi.fn(async () => true),
  recordPurchase: vi.fn(async () => true),
  recordRefund: vi.fn(async () => true),
  recordDispute: vi.fn(async () => true),
  recordFee: vi.fn(async () => true)
});

describe("stripe webhook store selection", () => {
  beforeEach(() => {
    clearBigQueryEnv();
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    restoreBigQueryEnv();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("skips BigQuery store when BigQuery env is absent", async () => {
    mocks.createStripeContentDbStore.mockReturnValue(null);

    const { resolveStripeAnalyticsStores } = await import("./route");
    const stores = resolveStripeAnalyticsStores();

    expect(stores).toHaveLength(0);
    expect(mocks.createStripeBigQueryStore).not.toHaveBeenCalled();
    expect(mocks.createStripeContentDbStore).toHaveBeenCalledTimes(1);
  });

  it("includes BigQuery store when BigQuery env is present", async () => {
    process.env.BIGQUERY_PROJECT_ID = "quiz-factory-test";
    const bigqueryStore = createStoreStub();

    mocks.createStripeBigQueryStore.mockReturnValue(bigqueryStore);
    mocks.createStripeContentDbStore.mockReturnValue(null);

    const { resolveStripeAnalyticsStores } = await import("./route");
    const stores = resolveStripeAnalyticsStores();

    expect(stores).toHaveLength(1);
    expect(stores[0]?.name).toBe("bigquery");
    expect(stores[0]?.store).toBe(bigqueryStore);
    expect(mocks.createStripeBigQueryStore).toHaveBeenCalledTimes(1);
  });

  it("continues writing when one store fails", async () => {
    process.env.BIGQUERY_PROJECT_ID = "quiz-factory-test";

    const bigqueryStore = createStoreStub();
    const contentDbStore = createStoreStub();
    const recordWebhookEventFailure = vi.fn(async () => {
      throw new Error("bigquery unavailable");
    });
    bigqueryStore.recordWebhookEvent = recordWebhookEventFailure;

    mocks.createStripeBigQueryStore.mockReturnValue(bigqueryStore);
    mocks.createStripeContentDbStore.mockReturnValue(contentDbStore);

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const { createStripeAnalyticsStore } = await import("./route");
    const store = createStripeAnalyticsStore();
    const inserted = await store.recordWebhookEvent({
      stripe_event_id: "evt_123",
      type: "checkout.session.completed",
      created_utc: "2026-01-01T00:00:00.000Z",
      livemode: false,
      object_type: "checkout.session",
      object_id: "cs_123",
      request_id: "req_123",
      api_version: "2024-06-20",
      received_utc: "2026-01-01T00:00:01.000Z"
    });

    expect(inserted).toBe(true);
    expect(recordWebhookEventFailure).toHaveBeenCalledTimes(1);
    expect(contentDbStore.recordWebhookEvent).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });
});

import { env } from "@/lib/env";
import { NextResponse } from "next/server";

import { capturePosthogEvent } from "@/lib/analytics/posthog";
import { assertAllowedMethod } from "@/lib/security/request_guards";
import { createStripeBigQueryStore } from "@/lib/stripe/bigquery";
import { createStripeClient } from "@/lib/stripe/client";
import { createStripeContentDbStore } from "@/lib/stripe/content_db";
import type {
  StripeAnalyticsStore,
  StripeDisputeRow,
  StripeFeeRow,
  StripePurchaseRow,
  StripeRefundRow,
  StripeWebhookEventRow
} from "@/lib/stripe/store";
import {
  handleStripeWebhookEvent,
  verifyStripeSignature
} from "@/lib/stripe/webhook";

type NamedStripeStore = {
  name: "bigquery" | "content_db";
  store: StripeAnalyticsStore;
};

const isNonEmptyEnv = (value: string | undefined): boolean => {
  return typeof value === "string" && value.trim().length > 0;
};

const isJsonLikeContentType = (value: string | null): boolean => {
  if (!value) {
    return false;
  }

  const normalized = value.toLowerCase();
  return normalized.includes("application/json") || normalized.includes("+json");
};

const getMissingStripeEnv = (): string[] => {
  const required = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] as const;
  return required.filter((name) => !isNonEmptyEnv(env[name]));
};

const hasBigQueryStripeConfig = (): boolean => {
  return (
    isNonEmptyEnv(env.BIGQUERY_PROJECT_ID) ||
    isNonEmptyEnv(env.GOOGLE_CLOUD_PROJECT) ||
    isNonEmptyEnv(env.GCP_PROJECT) ||
    isNonEmptyEnv(env.BIGQUERY_STRIPE_DATASET)
  );
};

export const resolveStripeAnalyticsStores = (): NamedStripeStore[] => {
  const stores: NamedStripeStore[] = [];

  if (hasBigQueryStripeConfig()) {
    try {
      stores.push({ name: "bigquery", store: createStripeBigQueryStore() });
    } catch (error) {
      console.error("[stripe_webhook] Failed to initialize BigQuery store.", error);
    }
  }

  try {
    const contentDbStore = createStripeContentDbStore();
    if (contentDbStore) {
      stores.push({ name: "content_db", store: contentDbStore });
    }
  } catch (error) {
    console.error("[stripe_webhook] Failed to initialize Content DB store.", error);
  }

  return stores;
};

class MultiStripeAnalyticsStore implements StripeAnalyticsStore {
  constructor(private readonly stores: NamedStripeStore[]) {}

  private async writeToStores<Row>(
    methodName: keyof StripeAnalyticsStore,
    row: Row
  ): Promise<boolean> {
    if (this.stores.length === 0) {
      return false;
    }

    let inserted = false;
    let successfulWrites = 0;

    for (const { name, store } of this.stores) {
      const method = store[methodName] as ((value: Row) => Promise<boolean>) | undefined;
      if (!method) {
        continue;
      }

      try {
        const didInsert = await method.call(store, row);
        successfulWrites += 1;
        inserted = inserted || didInsert;
      } catch (error) {
        console.error(
          `[stripe_webhook] ${name} store failed during ${String(methodName)}.`,
          error
        );
      }
    }

    if (successfulWrites === 0) {
      return false;
    }

    return inserted;
  }

  async recordWebhookEvent(row: StripeWebhookEventRow): Promise<boolean> {
    return this.writeToStores("recordWebhookEvent", row);
  }

  async recordPurchase(row: StripePurchaseRow): Promise<boolean> {
    return this.writeToStores("recordPurchase", row);
  }

  async recordRefund(row: StripeRefundRow): Promise<boolean> {
    return this.writeToStores("recordRefund", row);
  }

  async recordDispute(row: StripeDisputeRow): Promise<boolean> {
    return this.writeToStores("recordDispute", row);
  }

  async recordFee(row: StripeFeeRow): Promise<boolean> {
    return this.writeToStores("recordFee", row);
  }
}

export const createStripeAnalyticsStore = (): StripeAnalyticsStore => {
  const stores = resolveStripeAnalyticsStores();

  if (stores.length === 1) {
    return stores[0].store;
  }

  return new MultiStripeAnalyticsStore(stores);
};

export const POST = async (request: Request): Promise<Response> => {
  const methodResponse = assertAllowedMethod(request, ["POST"]);
  if (methodResponse) {
    return methodResponse;
  }

  const contentType = request.headers.get("content-type");
  if (!isJsonLikeContentType(contentType)) {
    return NextResponse.json({ error: "Unsupported content type." }, { status: 415 });
  }

  const missingStripeEnv = getMissingStripeEnv();
  if (missingStripeEnv.length > 0) {
    return NextResponse.json(
      {
        error: `Missing required Stripe environment variables: ${missingStripeEnv.join(
          ", "
        )}.`
      },
      { status: 500 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET as string;

  const payload = await request.text();
  const validSignature = verifyStripeSignature({
    payload,
    signatureHeader: signature,
    secret: webhookSecret
  });
  if (!validSignature) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let event: unknown;
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const stripeClient = createStripeClient();
  if (!stripeClient) {
    return NextResponse.json(
      { error: "Stripe secret key is not configured." },
      { status: 500 }
    );
  }

  const store = createStripeAnalyticsStore();
  const result = await handleStripeWebhookEvent(
    event as Parameters<typeof handleStripeWebhookEvent>[0],
    {
      store,
      stripeClient,
      captureEvent: capturePosthogEvent
    }
  );

  return NextResponse.json({ received: true, status: result.status });
};

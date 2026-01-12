import { createHmac } from "crypto";
import { describe, expect, it, vi } from "vitest";

import { InMemoryStripeAnalyticsStore } from "./store";
import {
  buildPurchaseRowFromCheckoutSession,
  handleStripeWebhookEvent,
  verifyStripeSignature
} from "./webhook";

const buildSignatureHeader = (payload: string, secret: string, timestamp: number) => {
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`, "utf8")
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
};

const buildCheckoutCompletedEvent = () => ({
  id: "evt_checkout_123",
  type: "checkout.session.completed",
  created: 1_710_000_000,
  livemode: false,
  api_version: "2024-06-20",
  request: { id: "req_123" },
  data: {
    object: {
      id: "cs_test_123",
      object: "checkout.session",
      amount_total: 4900,
      currency: "eur",
      payment_status: "paid",
      customer: "cus_123",
      payment_intent: "pi_123",
      created: 1_710_000_000,
      metadata: {
        tenant_id: "tenant-demo",
        test_id: "test-demo",
        session_id: "session-abc",
        distinct_id: "visitor-xyz",
        locale: "en",
        utm_source: "google",
        utm_medium: "cpc",
        utm_campaign: "spring",
        fbclid: "fb-1",
        product_type: "single",
        is_upsell: "false"
      }
    }
  }
});

describe("stripe webhook signature verification", () => {
  it("accepts a valid signature", () => {
    const secret = "whsec_test";
    const payload = JSON.stringify({ id: "evt_1" });
    const timestamp = Math.floor(Date.now() / 1000);
    const signatureHeader = buildSignatureHeader(payload, secret, timestamp);

    const isValid = verifyStripeSignature({
      payload,
      signatureHeader,
      secret,
      now: () => new Date(timestamp * 1000)
    });

    expect(isValid).toBe(true);
  });

  it("rejects an invalid signature", () => {
    const secret = "whsec_test";
    const payload = JSON.stringify({ id: "evt_1" });
    const timestamp = Math.floor(Date.now() / 1000);
    const signatureHeader = buildSignatureHeader(payload, "wrong_secret", timestamp);

    const isValid = verifyStripeSignature({
      payload,
      signatureHeader,
      secret,
      now: () => new Date(timestamp * 1000)
    });

    expect(isValid).toBe(false);
  });
});

describe("stripe webhook processing", () => {
  it("maps metadata into raw_stripe.purchases", () => {
    const event = buildCheckoutCompletedEvent();
    const session = event.data.object;
    const purchaseRow = buildPurchaseRowFromCheckoutSession(
      session,
      new Date(event.created * 1000)
    );

    expect(purchaseRow.tenant_id).toBe("tenant-demo");
    expect(purchaseRow.test_id).toBe("test-demo");
    expect(purchaseRow.session_id).toBe("session-abc");
    expect(purchaseRow.distinct_id).toBe("visitor-xyz");
    expect(purchaseRow.locale).toBe("en");
    expect(purchaseRow.utm_source).toBe("google");
    expect(purchaseRow.fbclid).toBe("fb-1");
    expect(purchaseRow.is_upsell).toBe(false);
    expect(purchaseRow.product_type).toBe("single");
  });

  it("dedupes repeated Stripe events", async () => {
    const event = buildCheckoutCompletedEvent();
    const store = new InMemoryStripeAnalyticsStore();
    const captureEvent = vi.fn(async () => null);
    const stripeClient = {
      paymentIntents: {
        retrieve: vi.fn(async () => ({ id: "pi_123", latest_charge: "ch_123" }))
      },
      charges: {
        retrieve: vi.fn(async () => ({
          id: "ch_123",
          balance_transaction: "txn_123",
          created: event.created,
          metadata: event.data.object.metadata
        }))
      },
      balanceTransactions: {
        retrieve: vi.fn(async () => ({ id: "txn_123", fee: 100, net: 4800 }))
      }
    };

    await handleStripeWebhookEvent(event, { store, stripeClient, captureEvent });
    await handleStripeWebhookEvent(event, { store, stripeClient, captureEvent });

    expect(store.webhookEvents).toHaveLength(1);
    expect(store.purchases).toHaveLength(1);
    expect(captureEvent).toHaveBeenCalledTimes(1);
  });

  it("replays a checkout event and emits purchase_success", async () => {
    const event = buildCheckoutCompletedEvent();
    const store = new InMemoryStripeAnalyticsStore();
    const captureEvent = vi.fn(async (name: string, properties: Record<string, unknown>) => ({
      name,
      properties
    }));
    const stripeClient = {
      paymentIntents: {
        retrieve: vi.fn(async () => ({ id: "pi_123", latest_charge: "ch_123" }))
      },
      charges: {
        retrieve: vi.fn(async () => ({
          id: "ch_123",
          balance_transaction: "txn_123",
          created: event.created,
          metadata: event.data.object.metadata
        }))
      },
      balanceTransactions: {
        retrieve: vi.fn(async () => ({ id: "txn_123", fee: 100, net: 4800 }))
      }
    };

    await handleStripeWebhookEvent(event, { store, stripeClient, captureEvent });

    expect(store.webhookEvents).toHaveLength(1);
    expect(store.purchases).toHaveLength(1);
    expect(store.fees).toHaveLength(1);
    expect(captureEvent).toHaveBeenCalledTimes(1);

    const [eventName, properties] = captureEvent.mock.calls[0] ?? [];
    expect(eventName).toBe("purchase_success");
    expect(properties.session_id).toBe("session-abc");
  });
});

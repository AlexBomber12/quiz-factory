import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";
import { resetRateLimitState } from "../../../../lib/security/request_guards";
import { CREDITS_COOKIE } from "../../../../lib/credits";
import { REPORT_TOKEN } from "../../../../lib/product/report_token";
import { createStripeClient } from "../../../../lib/stripe/client";

vi.mock("../../../../lib/stripe/client", () => ({
  createStripeClient: vi.fn()
}));

const createStripeClientMock = vi.mocked(createStripeClient);

const buildRequest = (body: Record<string, unknown>) =>
  new Request("https://tenant.example.com/api/checkout/confirm", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "tenant.example.com"
    },
    body: JSON.stringify(body)
  });

describe("POST /api/checkout/confirm", () => {
  beforeEach(() => {
    resetRateLimitState();
    process.env.REPORT_TOKEN_SECRET = "test-report-token-secret";
  });

  afterEach(() => {
    delete process.env.REPORT_TOKEN_SECRET;
  });

  it("confirms paid checkout session and issues report token", async () => {
    const retrieveSession = vi.fn(async () => ({
      payment_status: "paid",
      amount_total: 499,
      currency: "eur",
      metadata: {
        purchase_id: "purchase-123",
        tenant_id: "tenant-tenant-example-com",
        test_id: "test-focus-rhythm",
        session_id: "session-123",
        distinct_id: "distinct-123",
        locale: "en",
        product_type: "pack_5",
        pricing_variant: "base",
        offer_key: "pack5",
        credits_granted: "5",
        currency: "EUR",
        unit_price_eur: "4.99"
      }
    }));

    createStripeClientMock.mockReturnValue({
      checkout: {
        sessions: {
          retrieve: retrieveSession
        }
      }
    } as unknown as ReturnType<typeof createStripeClient>);

    const response = await POST(buildRequest({ stripe_session_id: "cs_123" }));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      ok: true,
      purchase_id: "purchase-123",
      test_id: "test-focus-rhythm",
      credits_granted: 5,
      credits_balance_after: 5
    });

    expect(retrieveSession).toHaveBeenCalledWith("cs_123");
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${REPORT_TOKEN}=`);
    expect(setCookie).toContain(`${CREDITS_COOKIE}=`);
  });

  it("rejects missing stripe_session_id", async () => {
    const response = await POST(buildRequest({}));

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error).toBe("stripe_session_id is required.");
  });

  it("rejects unpaid checkout sessions", async () => {
    const retrieveSession = vi.fn(async () => ({
      payment_status: "unpaid",
      metadata: {
        purchase_id: "purchase-123",
        tenant_id: "tenant-tenant-example-com",
        test_id: "test-focus-rhythm",
        session_id: "session-123",
        distinct_id: "distinct-123",
        locale: "en",
        product_type: "single",
        pricing_variant: "intro"
      }
    }));

    createStripeClientMock.mockReturnValue({
      checkout: {
        sessions: {
          retrieve: retrieveSession
        }
      }
    } as unknown as ReturnType<typeof createStripeClient>);

    const response = await POST(buildRequest({ stripe_session_id: "cs_456" }));

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error).toBe("Checkout session is not paid.");
  });
});

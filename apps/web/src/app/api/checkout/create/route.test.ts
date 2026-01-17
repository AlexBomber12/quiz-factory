import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";
import { resetRateLimitState } from "../../../../lib/security/request_guards";
import { RESULT_COOKIE, signResultCookie } from "../../../../lib/product/result_cookie";
import { createStripeClient } from "../../../../lib/stripe/client";
import { buildStripeMetadata } from "../../../../lib/stripe/metadata";

vi.mock("../../../../lib/stripe/client", () => ({
  createStripeClient: vi.fn()
}));

const createStripeClientMock = vi.mocked(createStripeClient);

const buildRequest = (body: Record<string, unknown>, cookieHeader?: string) =>
  new Request("https://tenant.example.com/api/checkout/create", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "tenant.example.com",
      ...(cookieHeader ? { cookie: cookieHeader } : {})
    },
    body: JSON.stringify(body)
  });

describe("POST /api/checkout/create", () => {
  beforeEach(() => {
    resetRateLimitState();
  });

  const cases = [
    { productType: "single", pricingVariant: "intro", amount: 149 },
    { productType: "pack_5", pricingVariant: "base", amount: 499 },
    { productType: "pack_10", pricingVariant: "base", amount: 799 }
  ] as const;

  it.each(cases)(
    "creates Stripe session for %s with expected pricing and URLs",
    async ({ productType, pricingVariant, amount }) => {
      const purchaseId = "purchase-123";
      const resultPayload = {
        tenant_id: "tenant-tenant-example-com",
        session_id: "session-123",
        distinct_id: "distinct-123",
        test_id: "test-focus-rhythm",
        computed_at_utc: "2024-01-01T00:00:00.000Z",
        band_id: "steady",
        scale_scores: { tempo: 10 }
      };
      const resultCookie = signResultCookie(resultPayload);
      const trustedMetadata = buildStripeMetadata({
        tenantId: resultPayload.tenant_id,
        testId: resultPayload.test_id,
        sessionId: resultPayload.session_id,
        distinctId: resultPayload.distinct_id,
        locale: "en",
        productType,
        pricingVariant,
        isUpsell: false,
        purchaseId
      });

      const createSession = vi.fn(async (payload: Record<string, unknown>) => ({
        id: "sess_123",
        url: "https://checkout.stripe.test/session",
        payload
      }));
      createStripeClientMock.mockReturnValue({
        checkout: {
          sessions: {
            create: createSession
          }
        }
      } as unknown as ReturnType<typeof createStripeClient>);

      const response = await POST(
        buildRequest(
          {
            purchase_id: purchaseId,
            product_type: productType,
            pricing_variant: pricingVariant,
            stripe_metadata: trustedMetadata
          },
          `${RESULT_COOKIE}=${resultCookie}`
        )
      );

      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload.checkout_url).toBe("https://checkout.stripe.test/session");
      expect(payload.stripe_session_id).toBe("sess_123");

      expect(createSession).toHaveBeenCalledTimes(1);
      const sessionArgs = createSession.mock.calls[0]?.[0] as {
        line_items: Array<{
          price_data: { currency: string; unit_amount: number };
        }>;
        metadata: Record<string, string>;
        success_url: string;
        cancel_url: string;
      };

      expect(sessionArgs.line_items[0]?.price_data.currency).toBe("eur");
      expect(sessionArgs.line_items[0]?.price_data.unit_amount).toBe(amount);
      expect(sessionArgs.metadata).toEqual(trustedMetadata);
      expect(sessionArgs.success_url).toBe(
        "https://tenant.example.com/checkout/success?session_id={CHECKOUT_SESSION_ID}"
      );
      expect(sessionArgs.cancel_url).toBe("https://tenant.example.com/t/focus-rhythm/pay");
    }
  );
});

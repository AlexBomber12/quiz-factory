import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";
import { resetRateLimitState } from "../../../../lib/security/request_guards";
import { RESULT_COOKIE, signResultCookie } from "../../../../lib/product/result_cookie";
import { getOffer } from "../../../../lib/pricing";
import { createStripeClient } from "../../../../lib/stripe/client";
import { buildStripeMetadata } from "../../../../lib/stripe/metadata";

vi.mock("../../../../lib/stripe/client", () => ({
  createStripeClient: vi.fn()
}));

const createStripeClientMock = vi.mocked(createStripeClient);

const PRICE_ENV_VALUES = {
  STRIPE_PRICE_SINGLE_INTRO_149_EUR: "price_single_intro",
  STRIPE_PRICE_PACK5_EUR: "price_pack5",
  STRIPE_PRICE_PACK10_EUR: "price_pack10"
} as const;

const ORIGINAL_PRICE_ENV_VALUES: Record<string, string | undefined> = Object.fromEntries(
  Object.keys(PRICE_ENV_VALUES).map((key) => [key, process.env[key]])
);

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
    for (const [key, value] of Object.entries(PRICE_ENV_VALUES)) {
      process.env[key] = value;
    }
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(ORIGINAL_PRICE_ENV_VALUES)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  const cases = [
    { offerKey: "single_intro_149", priceId: PRICE_ENV_VALUES.STRIPE_PRICE_SINGLE_INTRO_149_EUR },
    { offerKey: "pack5", priceId: PRICE_ENV_VALUES.STRIPE_PRICE_PACK5_EUR },
    { offerKey: "pack10", priceId: PRICE_ENV_VALUES.STRIPE_PRICE_PACK10_EUR }
  ] as const;

  it.each(cases)(
    "creates Stripe session for %s with expected price id and URLs",
    async ({ offerKey, priceId }) => {
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
      const offer = getOffer(offerKey);
      expect(offer.stripe_price_id).toBe(priceId);
      const trustedMetadata = buildStripeMetadata({
        tenantId: resultPayload.tenant_id,
        testId: resultPayload.test_id,
        sessionId: resultPayload.session_id,
        distinctId: resultPayload.distinct_id,
        locale: "en",
        offerKey: offer.offer_key,
        productType: offer.product_type,
        creditsGranted: offer.credits_granted,
        pricingVariant: offer.pricing_variant,
        unitPriceEur: offer.display_price_eur,
        currency: offer.currency,
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
            offer_key: offerKey,
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
          price: string;
          quantity: number;
        }>;
        metadata: Record<string, string>;
        success_url: string;
        cancel_url: string;
      };

      expect(sessionArgs.line_items[0]?.quantity).toBe(1);
      expect(sessionArgs.line_items[0]?.price).toBe(priceId);
      expect(sessionArgs.metadata).toEqual(trustedMetadata);
      expect(sessionArgs.metadata.offer_key).toBe(offer.offer_key);
      expect(sessionArgs.metadata.credits_granted).toBe(String(offer.credits_granted));
      expect(sessionArgs.metadata.unit_price_eur).toBe(String(offer.display_price_eur));
      expect(sessionArgs.success_url).toBe(
        "https://tenant.example.com/checkout/success?session_id={CHECKOUT_SESSION_ID}"
      );
      expect(sessionArgs.cancel_url).toBe("https://tenant.example.com/t/focus-rhythm/pay");
    }
  );

  it("fails fast when the Stripe price id env var is missing", async () => {
    const purchaseId = "purchase-456";
    const resultPayload = {
      tenant_id: "tenant-tenant-example-com",
      session_id: "session-456",
      distinct_id: "distinct-456",
      test_id: "test-focus-rhythm",
      computed_at_utc: "2024-01-01T00:00:00.000Z",
      band_id: "steady",
      scale_scores: { tempo: 10 }
    };
    const resultCookie = signResultCookie(resultPayload);

    delete process.env.STRIPE_PRICE_PACK5_EUR;
    const offer = getOffer("pack5");
    const trustedMetadata = buildStripeMetadata({
      tenantId: resultPayload.tenant_id,
      testId: resultPayload.test_id,
      sessionId: resultPayload.session_id,
      distinctId: resultPayload.distinct_id,
      locale: "en",
      offerKey: offer.offer_key,
      productType: offer.product_type,
      creditsGranted: offer.credits_granted,
      pricingVariant: offer.pricing_variant,
      unitPriceEur: offer.display_price_eur,
      currency: offer.currency,
      isUpsell: false,
      purchaseId
    });

    createStripeClientMock.mockReturnValue({
      checkout: {
        sessions: {
          create: vi.fn()
        }
      }
    } as unknown as ReturnType<typeof createStripeClient>);

    const response = await POST(
      buildRequest(
        {
          purchase_id: purchaseId,
          offer_key: "pack5",
          stripe_metadata: trustedMetadata
        },
        `${RESULT_COOKIE}=${resultCookie}`
      )
    );

    expect(response.status).toBe(503);
    const payload = await response.json();
    expect(payload.error).toContain("STRIPE_PRICE_PACK5_EUR");
  });
});

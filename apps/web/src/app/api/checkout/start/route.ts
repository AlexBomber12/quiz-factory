import { normalizeString } from "@/lib/utils/strings";
import { handleAnalyticsEvent } from "@/lib/analytics/server";
import {
  DEFAULT_EVENT_BODY_BYTES,
  DEFAULT_EVENT_RATE_LIMIT,
  assertAllowedHostAsync,
  assertAllowedMethod,
  assertAllowedOriginAsync,
  assertMaxBodyBytes,
  rateLimit
} from "@/lib/security/request_guards";
import {
  DEFAULT_OFFER_KEY,
  getOffer,
  isOfferKey,
  type OfferKey
} from "@/lib/pricing";
import { buildStripeMetadata } from "@/lib/stripe/metadata";

const normalizeBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }

  return null;
};

export const POST = async (request: Request): Promise<Response> => {
  const methodResponse = assertAllowedMethod(request, ["POST"]);
  if (methodResponse) {
    return methodResponse;
  }

  const hostResponse = await assertAllowedHostAsync(request);
  if (hostResponse) {
    return hostResponse;
  }

  const originResponse = await assertAllowedOriginAsync(request);
  if (originResponse) {
    return originResponse;
  }

  const rateLimitResponse = rateLimit(request, DEFAULT_EVENT_RATE_LIMIT);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const bodyResponse = await assertMaxBodyBytes(request, DEFAULT_EVENT_BODY_BYTES);
  if (bodyResponse) {
    return bodyResponse;
  }

  let offerKey: OfferKey = DEFAULT_OFFER_KEY;
  try {
    const clonedBody = (await request.clone().json()) as Record<string, unknown>;
    const requestedOfferKey = normalizeString(clonedBody.offer_key);
    if (requestedOfferKey) {
      if (!isOfferKey(requestedOfferKey)) {
        return Response.json({ error: "Invalid offer_key." }, { status: 400 });
      }
      offerKey = requestedOfferKey;
    }
  } catch {
    offerKey = DEFAULT_OFFER_KEY;
  }

  const offer = getOffer(offerKey);

  return handleAnalyticsEvent(request, {
    event: "checkout_start",
    requireAttemptToken: true,
    extendProperties: () => ({
      offer_key: offer.offer_key,
      product_type: offer.product_type,
      credits_granted: offer.credits_granted,
      pricing_variant: offer.pricing_variant,
      unit_price_eur: offer.display_price_eur,
      currency: offer.currency
    }),
    extendResponse: ({ body, properties, utm, clickIds }) => {
      const isUpsell = normalizeBoolean(body.is_upsell);

      return {
        stripe_metadata: buildStripeMetadata({
          tenantId: properties.tenant_id,
          testId: properties.test_id,
          sessionId: properties.session_id,
          distinctId: properties.distinct_id,
          locale: properties.locale,
          utm,
          clickIds,
          isUpsell,
          offerKey: offer.offer_key,
          productType: offer.product_type,
          creditsGranted: offer.credits_granted,
          pricingVariant: offer.pricing_variant,
          unitPriceEur: offer.display_price_eur,
          currency: offer.currency,
          deviceType: properties.device_type,
          purchaseId: properties.purchase_id
        })
      };
    }
  });
};

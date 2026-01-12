import { normalizeString } from "../../../../lib/analytics/session";
import { handleAnalyticsEvent } from "../../../../lib/analytics/server";
import { buildStripeMetadata } from "../../../../lib/stripe/metadata";

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
  return handleAnalyticsEvent(request, {
    event: "checkout_start",
    extendResponse: ({ body, properties, utm, clickIds }) => {
      const productType = normalizeString(body.product_type);
      const pricingVariant = normalizeString(body.pricing_variant);
      const isUpsell = normalizeBoolean(body.is_upsell);
      const purchaseId = normalizeString(body.purchase_id);

      return {
        stripe_metadata: buildStripeMetadata({
          tenantId: properties.tenant_id,
          testId: properties.test_id,
          sessionId: properties.session_id,
          distinctId: properties.distinct_id,
          locale: properties.locale,
          utm,
          clickIds,
          productType,
          isUpsell,
          pricingVariant,
          deviceType: properties.device_type,
          purchaseId
        })
      };
    }
  });
};

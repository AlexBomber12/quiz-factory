import type { ClickIdParams, UtmParams } from "../analytics/session";
import { normalizeString } from "../analytics/session";

export type StripeMetadataInput = {
  tenantId?: string | null;
  testId?: string | null;
  sessionId?: string | null;
  distinctId?: string | null;
  locale?: string | null;
  utm?: UtmParams | null;
  clickIds?: ClickIdParams | null;
  offerKey?: string | null;
  productType?: string | null;
  creditsGranted?: number | null;
  isUpsell?: boolean | null;
  pricingVariant?: string | null;
  unitPriceEur?: number | null;
  currency?: string | null;
  deviceType?: string | null;
  purchaseId?: string | null;
};

export type ParsedStripeMetadata = {
  tenant_id: string | null;
  test_id: string | null;
  session_id: string | null;
  distinct_id: string | null;
  locale: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  fbclid: string | null;
  gclid: string | null;
  ttclid: string | null;
  offer_key: string | null;
  product_type: string | null;
  credits_granted: number | null;
  is_upsell: boolean | null;
  pricing_variant: string | null;
  unit_price_eur: number | null;
  currency: string | null;
  device_type: string | null;
  purchase_id: string | null;
};

const addMetadataValue = (
  metadata: Record<string, string>,
  key: string,
  value: unknown
): void => {
  const normalized = normalizeString(value);
  if (normalized) {
    metadata[key] = normalized;
  }
};

const addMetadataNumber = (
  metadata: Record<string, string>,
  key: string,
  value: unknown
): void => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return;
  }

  metadata[key] = String(value);
};

const normalizeBoolean = (value: string | null | undefined): boolean | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }

  return null;
};

const normalizeNumber = (value: string | null | undefined): number | null => {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const buildStripeMetadata = (input: StripeMetadataInput): Record<string, string> => {
  const metadata: Record<string, string> = {};

  addMetadataValue(metadata, "tenant_id", input.tenantId);
  addMetadataValue(metadata, "test_id", input.testId);
  addMetadataValue(metadata, "session_id", input.sessionId);
  addMetadataValue(metadata, "distinct_id", input.distinctId);
  addMetadataValue(metadata, "locale", input.locale);
  addMetadataValue(metadata, "offer_key", input.offerKey);
  addMetadataValue(metadata, "product_type", input.productType);
  addMetadataNumber(metadata, "credits_granted", input.creditsGranted);
  addMetadataValue(metadata, "pricing_variant", input.pricingVariant);
  addMetadataNumber(metadata, "unit_price_eur", input.unitPriceEur);
  addMetadataValue(metadata, "currency", input.currency);
  addMetadataValue(metadata, "device_type", input.deviceType);
  addMetadataValue(metadata, "purchase_id", input.purchaseId);

  if (input.isUpsell !== null && input.isUpsell !== undefined) {
    metadata.is_upsell = String(input.isUpsell);
  }

  if (input.utm) {
    addMetadataValue(metadata, "utm_source", input.utm.utm_source);
    addMetadataValue(metadata, "utm_medium", input.utm.utm_medium);
    addMetadataValue(metadata, "utm_campaign", input.utm.utm_campaign);
    addMetadataValue(metadata, "utm_content", input.utm.utm_content);
    addMetadataValue(metadata, "utm_term", input.utm.utm_term);
  }

  if (input.clickIds) {
    addMetadataValue(metadata, "fbclid", input.clickIds.fbclid);
    addMetadataValue(metadata, "gclid", input.clickIds.gclid);
    addMetadataValue(metadata, "ttclid", input.clickIds.ttclid);
  }

  return metadata;
};

export const parseStripeMetadata = (
  metadata?: Record<string, string | null | undefined> | null
): ParsedStripeMetadata => {
  const data = metadata ?? {};

  return {
    tenant_id: normalizeString(data.tenant_id),
    test_id: normalizeString(data.test_id),
    session_id: normalizeString(data.session_id),
    distinct_id: normalizeString(data.distinct_id),
    locale: normalizeString(data.locale),
    utm_source: normalizeString(data.utm_source),
    utm_medium: normalizeString(data.utm_medium),
    utm_campaign: normalizeString(data.utm_campaign),
    utm_content: normalizeString(data.utm_content),
    utm_term: normalizeString(data.utm_term),
    fbclid: normalizeString(data.fbclid),
    gclid: normalizeString(data.gclid),
    ttclid: normalizeString(data.ttclid),
    offer_key: normalizeString(data.offer_key),
    product_type: normalizeString(data.product_type),
    credits_granted: normalizeNumber(normalizeString(data.credits_granted)),
    is_upsell: normalizeBoolean(normalizeString(data.is_upsell)),
    pricing_variant: normalizeString(data.pricing_variant),
    unit_price_eur: normalizeNumber(normalizeString(data.unit_price_eur)),
    currency: normalizeString(data.currency),
    device_type: normalizeString(data.device_type),
    purchase_id: normalizeString(data.purchase_id)
  };
};

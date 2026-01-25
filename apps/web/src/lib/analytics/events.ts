import type { ClickIdParams, UtmParams } from "./session";

export const ANALYTICS_EVENT_NAMES = [
  "page_view",
  "test_start",
  "test_complete",
  "result_preview_view",
  "paywall_view",
  "checkout_start",
  "purchase_success",
  "purchase_failed",
  "report_view",
  "report_pdf_download",
  "upsell_view",
  "upsell_accept",
  "refund_issued",
  "dispute_opened",
  "share_click"
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export type AnalyticsEventProperties = {
  tenant_id: string;
  session_id: string;
  distinct_id: string;
  test_id: string | null;
  event_id?: string | null;
  timestamp_utc: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  fbclid?: string | null;
  gclid?: string | null;
  ttclid?: string | null;
  referrer: string | null;
  country: string | null;
  language: string | null;
  device_type: string | null;
  locale: string | null;
  page_url?: string | null;
  page_type?: string | null;
  purchase_id?: string | null;
  failure_reason?: string | null;
  amount_eur?: number | null;
  currency?: string | null;
  offer_key?: string | null;
  product_type?: string | null;
  credits_granted?: number | null;
  credits_balance_after?: number | null;
  consumed_credit?: boolean | null;
  pricing_variant?: string | null;
  unit_price_eur?: number | null;
  payment_provider?: string | null;
  is_upsell?: boolean | null;
  upsell_id?: string | null;
  refund_id?: string | null;
  dispute_id?: string | null;
  share_target?: string | null;
};

export const buildBaseEventProperties = (input: {
  tenantId: string;
  sessionId: string;
  distinctId: string;
  testId: string | null;
  utm: UtmParams;
  clickIds?: ClickIdParams | null;
  locale?: string | null;
  referrer?: string | null;
  country?: string | null;
  language?: string | null;
  deviceType?: string | null;
}): AnalyticsEventProperties => {
  const timestampUtc = new Date().toISOString();
  const language = input.language ?? input.locale ?? null;

  return {
    tenant_id: input.tenantId,
    session_id: input.sessionId,
    distinct_id: input.distinctId,
    test_id: input.testId,
    timestamp_utc: timestampUtc,
    utm_source: input.utm.utm_source,
    utm_medium: input.utm.utm_medium,
    utm_campaign: input.utm.utm_campaign,
    utm_content: input.utm.utm_content,
    utm_term: input.utm.utm_term,
    fbclid: input.clickIds?.fbclid ?? null,
    gclid: input.clickIds?.gclid ?? null,
    ttclid: input.clickIds?.ttclid ?? null,
    referrer: input.referrer ?? null,
    country: input.country ?? null,
    language,
    device_type: input.deviceType ?? null,
    locale: input.locale ?? language
  };
};

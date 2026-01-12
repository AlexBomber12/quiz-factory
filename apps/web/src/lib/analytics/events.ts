import type { UtmParams } from "./session";

export type AnalyticsEventName =
  | "test_start"
  | "test_complete"
  | "result_preview_view"
  | "paywall_view"
  | "checkout_start"
  | "report_view"
  | "report_pdf_download";

export type AnalyticsEventProperties = {
  tenant_id: string;
  session_id: string;
  distinct_id: string;
  test_id: string;
  timestamp_utc: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referrer: string | null;
  country: string | null;
  language: string | null;
  device_type: string | null;
  locale: string | null;
  purchase_id?: string | null;
};

export const buildBaseEventProperties = (input: {
  tenantId: string;
  sessionId: string;
  distinctId: string;
  testId: string;
  utm: UtmParams;
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
    referrer: input.referrer ?? null,
    country: input.country ?? null,
    language,
    device_type: input.deviceType ?? null,
    locale: input.locale ?? language
  };
};

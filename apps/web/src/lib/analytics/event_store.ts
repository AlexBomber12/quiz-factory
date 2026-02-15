import { getContentDbPool, hasContentDatabaseUrl } from "../content_db/pool";

import type { AnalyticsEventName, AnalyticsEventProperties } from "./events";

type AnalyticsEventStoreRow = {
  event_id: string;
  event_name: AnalyticsEventName;
  occurred_at: string;
  occurred_date: string;
  tenant_id: string;
  test_id: string | null;
  session_id: string;
  distinct_id: string;
  locale: string | null;
  device_type: string | null;
  page_type: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  referrer: string | null;
  country: string | null;
};

const normalizeRequiredString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeOptionalString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const deriveOccurredDateUtc = (occurredAt: string): string | null => {
  const parsed = new Date(occurredAt);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
};

export const mapAnalyticsEventToContentDbRow = (
  eventName: AnalyticsEventName,
  properties: AnalyticsEventProperties
): AnalyticsEventStoreRow | null => {
  const eventId = normalizeRequiredString(properties.event_id);
  const occurredAt = normalizeRequiredString(properties.timestamp_utc);
  const tenantId = normalizeRequiredString(properties.tenant_id);
  const sessionId = normalizeRequiredString(properties.session_id);
  const distinctId = normalizeRequiredString(properties.distinct_id);

  if (!eventId || !occurredAt || !tenantId || !sessionId || !distinctId) {
    return null;
  }

  const occurredDate = deriveOccurredDateUtc(occurredAt);
  if (!occurredDate) {
    return null;
  }

  return {
    event_id: eventId,
    event_name: eventName,
    occurred_at: occurredAt,
    occurred_date: occurredDate,
    tenant_id: tenantId,
    test_id: normalizeOptionalString(properties.test_id),
    session_id: sessionId,
    distinct_id: distinctId,
    locale: normalizeOptionalString(properties.locale),
    device_type: normalizeOptionalString(properties.device_type),
    page_type: normalizeOptionalString(properties.page_type),
    utm_source: normalizeOptionalString(properties.utm_source),
    utm_campaign: normalizeOptionalString(properties.utm_campaign),
    referrer: normalizeOptionalString(properties.referrer),
    country: normalizeOptionalString(properties.country)
  };
};

export const recordAnalyticsEventToContentDb = async (
  eventName: AnalyticsEventName,
  properties: AnalyticsEventProperties
): Promise<void> => {
  if (!hasContentDatabaseUrl()) {
    return;
  }

  const row = mapAnalyticsEventToContentDbRow(eventName, properties);
  if (!row) {
    return;
  }

  const pool = getContentDbPool();
  await pool.query(
    `
      INSERT INTO analytics_events (
        event_id,
        event_name,
        occurred_at,
        occurred_date,
        tenant_id,
        test_id,
        session_id,
        distinct_id,
        locale,
        device_type,
        page_type,
        utm_source,
        utm_campaign,
        referrer,
        country
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (event_id) DO NOTHING
    `,
    [
      row.event_id,
      row.event_name,
      row.occurred_at,
      row.occurred_date,
      row.tenant_id,
      row.test_id,
      row.session_id,
      row.distinct_id,
      row.locale,
      row.device_type,
      row.page_type,
      row.utm_source,
      row.utm_campaign,
      row.referrer,
      row.country
    ]
  );
};

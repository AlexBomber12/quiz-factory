CREATE TABLE IF NOT EXISTS analytics_events (
  event_id text PRIMARY KEY,
  event_name text NOT NULL,
  occurred_at timestamptz NOT NULL,
  occurred_date date NOT NULL,
  tenant_id text NOT NULL,
  test_id text,
  session_id text NOT NULL,
  distinct_id text NOT NULL,
  locale text,
  device_type text,
  page_type text,
  utm_source text,
  utm_campaign text,
  referrer text,
  country text
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_occurred_date_tenant
  ON analytics_events (occurred_date, tenant_id);

CREATE INDEX IF NOT EXISTS idx_analytics_events_occurred_date_tenant_test
  ON analytics_events (occurred_date, tenant_id, test_id);

CREATE INDEX IF NOT EXISTS idx_analytics_events_tenant_session
  ON analytics_events (tenant_id, session_id);

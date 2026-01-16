-- Alerts table for scheduled anomaly checks.

CREATE TABLE IF NOT EXISTS marts.alert_events (
  detected_at_utc TIMESTAMP,
  alert_name STRING,
  severity STRING,
  tenant_id STRING,
  details_json JSON,
  metric_value NUMERIC,
  threshold_value NUMERIC
)
PARTITION BY DATE(detected_at_utc)
CLUSTER BY alert_name, severity, tenant_id;

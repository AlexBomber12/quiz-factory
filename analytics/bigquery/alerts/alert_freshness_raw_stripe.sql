-- Alert when raw_stripe.purchases ingestion is stale.

DECLARE run_date DATE DEFAULT CURRENT_DATE();
DECLARE freshness_minutes INT64 DEFAULT 30;

DELETE FROM marts.alert_events
WHERE alert_name = 'raw_stripe_freshness'
  AND DATE(detected_at_utc) = run_date;

WITH latest AS (
  SELECT MAX(created_utc) AS last_purchase_created
  FROM raw_stripe.purchases
)
INSERT INTO marts.alert_events (
  detected_at_utc,
  alert_name,
  severity,
  tenant_id,
  details_json,
  metric_value,
  threshold_value
)
SELECT
  TIMESTAMP(run_date) AS detected_at_utc,
  'raw_stripe_freshness' AS alert_name,
  'critical' AS severity,
  CAST(NULL AS STRING) AS tenant_id,
  TO_JSON(STRUCT(
    'raw_stripe.purchases' AS source_table,
    FORMAT_DATE('%F', run_date) AS run_date,
    FORMAT_TIMESTAMP('%F %T UTC', last_purchase_created) AS last_purchase_created_utc,
    freshness_minutes AS freshness_threshold_minutes,
    TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), last_purchase_created, MINUTE) AS age_minutes
  )) AS details_json,
  CAST(TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), last_purchase_created, MINUTE) AS NUMERIC) AS metric_value,
  CAST(freshness_minutes AS NUMERIC) AS threshold_value
FROM latest
WHERE last_purchase_created IS NULL
   OR TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), last_purchase_created, MINUTE) > freshness_minutes;

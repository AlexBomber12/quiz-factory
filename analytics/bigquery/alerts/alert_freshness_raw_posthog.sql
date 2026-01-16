-- Alert when raw_posthog.events ingestion is stale.

DECLARE run_date DATE DEFAULT CURRENT_DATE();
DECLARE freshness_minutes INT64 DEFAULT 30;

DELETE FROM marts.alert_events
WHERE alert_name = 'raw_posthog_freshness'
  AND DATE(detected_at_utc) = run_date;

WITH latest AS (
  SELECT MAX(bq_ingested_timestamp) AS last_ingested
  FROM raw_posthog.events
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
  'raw_posthog_freshness' AS alert_name,
  'critical' AS severity,
  CAST(NULL AS STRING) AS tenant_id,
  TO_JSON(STRUCT(
    'raw_posthog.events' AS source_table,
    FORMAT_DATE('%F', run_date) AS run_date,
    FORMAT_TIMESTAMP('%F %T UTC', last_ingested) AS last_ingested_utc,
    freshness_minutes AS freshness_threshold_minutes,
    TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), last_ingested, MINUTE) AS age_minutes
  )) AS details_json,
  CAST(TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), last_ingested, MINUTE) AS NUMERIC) AS metric_value,
  CAST(freshness_minutes AS NUMERIC) AS threshold_value
FROM latest
WHERE last_ingested IS NULL
   OR TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), last_ingested, MINUTE) > freshness_minutes;

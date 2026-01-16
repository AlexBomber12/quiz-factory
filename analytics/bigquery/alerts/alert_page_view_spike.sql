-- Alert when page view visits spike above recent baseline.

DECLARE run_date DATE DEFAULT CURRENT_DATE();
DECLARE check_date DATE DEFAULT DATE_SUB(run_date, INTERVAL 1 DAY);
DECLARE lookback_days INT64 DEFAULT 7;
DECLARE spike_multiplier FLOAT64 DEFAULT 2.0;
DECLARE min_avg_visits INT64 DEFAULT 100;
DECLARE min_current_visits INT64 DEFAULT 200;

DELETE FROM marts.alert_events
WHERE alert_name = 'page_view_spike'
  AND DATE(detected_at_utc) = check_date;

WITH daily AS (
  SELECT
    date,
    tenant_id,
    SUM(visits) AS visits
  FROM marts.mart_funnel_daily
  WHERE date BETWEEN DATE_SUB(check_date, INTERVAL lookback_days DAY) AND check_date
  GROUP BY date, tenant_id
),

baseline AS (
  SELECT
    tenant_id,
    AVG(visits) AS avg_visits
  FROM daily
  WHERE date BETWEEN DATE_SUB(check_date, INTERVAL lookback_days DAY)
    AND DATE_SUB(check_date, INTERVAL 1 DAY)
  GROUP BY tenant_id
),

current AS (
  SELECT
    tenant_id,
    visits AS current_visits
  FROM daily
  WHERE date = check_date
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
  TIMESTAMP(check_date) AS detected_at_utc,
  'page_view_spike' AS alert_name,
  'warning' AS severity,
  current.tenant_id AS tenant_id,
  TO_JSON(STRUCT(
    FORMAT_DATE('%F', check_date) AS check_date,
    lookback_days AS lookback_days,
    current_visits,
    avg_visits,
    spike_multiplier AS spike_multiplier,
    min_avg_visits AS min_avg_visits,
    min_current_visits AS min_current_visits
  )) AS details_json,
  CAST(current_visits AS NUMERIC) AS metric_value,
  CAST(avg_visits * spike_multiplier AS NUMERIC) AS threshold_value
FROM current
JOIN baseline
  ON current.tenant_id = baseline.tenant_id
WHERE avg_visits >= min_avg_visits
  AND current_visits >= min_current_visits
  AND current_visits > avg_visits * spike_multiplier;

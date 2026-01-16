-- Alert when refund rate exceeds the threshold.

DECLARE run_date DATE DEFAULT CURRENT_DATE();
DECLARE check_date DATE DEFAULT DATE_SUB(run_date, INTERVAL 1 DAY);
DECLARE max_refund_rate FLOAT64 DEFAULT 0.05;
DECLARE min_gross_revenue_eur NUMERIC DEFAULT 100;

DELETE FROM marts.alert_events
WHERE alert_name = 'refund_spike'
  AND DATE(detected_at_utc) = check_date;

WITH daily AS (
  SELECT
    date,
    tenant_id,
    SUM(gross_revenue_eur) AS gross_revenue_eur,
    SUM(refunds_eur) AS refunds_eur,
    SAFE_DIVIDE(SUM(refunds_eur), SUM(gross_revenue_eur)) AS refund_rate
  FROM marts.mart_pnl_daily
  WHERE date = check_date
  GROUP BY date, tenant_id
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
  'refund_spike' AS alert_name,
  'warning' AS severity,
  tenant_id,
  TO_JSON(STRUCT(
    FORMAT_DATE('%F', check_date) AS check_date,
    gross_revenue_eur,
    refunds_eur,
    refund_rate,
    max_refund_rate AS refund_rate_threshold,
    min_gross_revenue_eur AS min_gross_revenue_eur
  )) AS details_json,
  CAST(refund_rate AS NUMERIC) AS metric_value,
  CAST(max_refund_rate AS NUMERIC) AS threshold_value
FROM daily
WHERE gross_revenue_eur >= min_gross_revenue_eur
  AND refund_rate > max_refund_rate;

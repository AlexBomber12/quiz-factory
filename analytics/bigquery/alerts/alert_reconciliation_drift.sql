-- Alert when Stripe vs event reconciliation drift exceeds thresholds.

DECLARE run_date DATE DEFAULT CURRENT_DATE();
DECLARE check_date DATE DEFAULT DATE_SUB(run_date, INTERVAL 1 DAY);
DECLARE max_pct FLOAT64 DEFAULT 0.02;
DECLARE min_purchase_diff INT64 DEFAULT 5;
DECLARE min_revenue_diff NUMERIC DEFAULT 50;

DELETE FROM marts.alert_events
WHERE alert_name = 'reconciliation_drift'
  AND DATE(detected_at_utc) = check_date;

WITH drift AS (
  SELECT
    date,
    stripe_purchase_count,
    stripe_gross_revenue_eur,
    event_purchase_count,
    event_gross_revenue_eur,
    purchase_count_diff,
    gross_revenue_diff_eur,
    purchase_count_diff_pct,
    gross_revenue_diff_pct
  FROM marts.mart_reconciliation_daily
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
  'reconciliation_drift' AS alert_name,
  'warning' AS severity,
  CAST(NULL AS STRING) AS tenant_id,
  TO_JSON(STRUCT(
    FORMAT_DATE('%F', check_date) AS check_date,
    stripe_purchase_count,
    stripe_gross_revenue_eur,
    event_purchase_count,
    event_gross_revenue_eur,
    purchase_count_diff,
    gross_revenue_diff_eur,
    purchase_count_diff_pct,
    gross_revenue_diff_pct,
    (
      stripe_purchase_count IS NULL
      OR event_purchase_count IS NULL
      OR stripe_gross_revenue_eur IS NULL
      OR event_gross_revenue_eur IS NULL
    ) AS missing_side,
    max_pct AS drift_threshold_pct,
    min_purchase_diff AS min_purchase_diff,
    min_revenue_diff AS min_revenue_diff
  )) AS details_json,
  CAST(
    CASE
      WHEN stripe_purchase_count IS NULL
        OR event_purchase_count IS NULL
        OR stripe_gross_revenue_eur IS NULL
        OR event_gross_revenue_eur IS NULL
        THEN 1
      ELSE GREATEST(ABS(purchase_count_diff_pct), ABS(gross_revenue_diff_pct))
    END AS NUMERIC
  ) AS metric_value,
  CAST(max_pct AS NUMERIC) AS threshold_value
FROM drift
WHERE (
  ABS(purchase_count_diff_pct) > max_pct
  AND ABS(purchase_count_diff) > min_purchase_diff
) OR (
  ABS(gross_revenue_diff_pct) > max_pct
  AND ABS(gross_revenue_diff_eur) > min_revenue_diff
) OR (
  stripe_purchase_count IS NULL
  OR event_purchase_count IS NULL
  OR stripe_gross_revenue_eur IS NULL
  OR event_gross_revenue_eur IS NULL
);

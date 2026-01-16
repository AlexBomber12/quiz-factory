-- Alert when purchase conversion drops materially day over day.

DECLARE run_date DATE DEFAULT CURRENT_DATE();
DECLARE check_date DATE DEFAULT DATE_SUB(run_date, INTERVAL 1 DAY);
DECLARE prior_date DATE DEFAULT DATE_SUB(run_date, INTERVAL 2 DAY);
DECLARE drop_pct FLOAT64 DEFAULT 0.30;
DECLARE min_visits INT64 DEFAULT 100;
DECLARE min_purchases INT64 DEFAULT 5;

DELETE FROM marts.alert_events
WHERE alert_name = 'conversion_drop'
  AND DATE(detected_at_utc) = check_date;

WITH top_tenants AS (
  SELECT tenant_id
  FROM marts.mart_pnl_daily
  WHERE date BETWEEN DATE_SUB(check_date, INTERVAL 14 DAY) AND check_date
  GROUP BY tenant_id
  ORDER BY SUM(net_revenue_eur) DESC
  LIMIT 5
),

daily AS (
  SELECT
    date,
    tenant_id,
    SUM(visits) AS visits,
    SUM(purchases) AS purchases,
    SAFE_DIVIDE(SUM(purchases), SUM(visits)) AS conversion_rate
  FROM marts.mart_funnel_daily
  WHERE date IN (check_date, prior_date)
  GROUP BY date, tenant_id
),

joined AS (
  SELECT
    curr.tenant_id,
    curr.visits AS current_visits,
    curr.purchases AS current_purchases,
    curr.conversion_rate AS current_rate,
    prev.visits AS prior_visits,
    prev.purchases AS prior_purchases,
    prev.conversion_rate AS prior_rate
  FROM daily curr
  JOIN daily prev
    ON curr.tenant_id = prev.tenant_id
   AND curr.date = check_date
   AND prev.date = prior_date
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
  'conversion_drop' AS alert_name,
  'warning' AS severity,
  joined.tenant_id AS tenant_id,
  TO_JSON(STRUCT(
    FORMAT_DATE('%F', check_date) AS check_date,
    FORMAT_DATE('%F', prior_date) AS prior_date,
    current_visits,
    current_purchases,
    current_rate,
    prior_visits,
    prior_purchases,
    prior_rate,
    drop_pct AS drop_threshold_pct,
    min_visits AS min_visits,
    min_purchases AS min_purchases
  )) AS details_json,
  CAST(current_rate AS NUMERIC) AS metric_value,
  CAST(prior_rate * (1 - drop_pct) AS NUMERIC) AS threshold_value
FROM joined
JOIN top_tenants
  ON joined.tenant_id = top_tenants.tenant_id
WHERE prior_visits >= min_visits
  AND current_visits >= min_visits
  AND prior_purchases >= min_purchases
  AND current_rate < prior_rate * (1 - drop_pct);

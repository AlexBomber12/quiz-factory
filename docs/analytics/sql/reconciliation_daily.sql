-- Stripe vs events reconciliation from marts.mart_reconciliation_daily
-- Date columns already reflect the reporting timezone.
-- Parameters:
--   @start_date DATE
--   @end_date DATE

select
  date,
  stripe_purchase_count,
  stripe_gross_revenue_eur,
  event_purchase_count,
  event_gross_revenue_eur,
  purchase_count_diff,
  gross_revenue_diff_eur,
  purchase_count_diff_pct,
  gross_revenue_diff_pct
from marts.mart_reconciliation_daily
where date between @start_date and @end_date
order by date desc;

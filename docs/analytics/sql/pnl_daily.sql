-- P&L daily metrics from marts.mart_pnl_daily
-- Date columns already reflect the reporting timezone.
-- Parameters:
--   @start_date DATE
--   @end_date DATE
--   @tenant_id STRING
--   @locale STRING
--   @test_id STRING
--   @channel_key STRING
-- Set optional filters to NULL to include all values.

select
  date,
  tenant_id,
  test_id,
  locale,
  channel_key,
  gross_revenue_eur,
  refunds_eur,
  disputes_eur,
  payment_fees_eur,
  net_revenue_eur,
  safe_divide(refunds_eur, gross_revenue_eur) as refund_rate,
  safe_divide(payment_fees_eur, gross_revenue_eur) as payment_fee_rate
from marts.mart_pnl_daily
where date between @start_date and @end_date
  and (@tenant_id is null or tenant_id = @tenant_id)
  and (@locale is null or locale = @locale)
  and (@test_id is null or test_id = @test_id)
  and (@channel_key is null or channel_key = @channel_key)
order by date desc, tenant_id, test_id, channel_key;

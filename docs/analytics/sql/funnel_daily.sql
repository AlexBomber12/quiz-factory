-- Funnel daily metrics from marts.mart_funnel_daily
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
  visits,
  unique_visitors,
  test_starts,
  test_completes,
  paywall_views,
  checkout_starts,
  purchases,
  test_start_rate,
  test_complete_rate,
  paywall_view_rate as paywall_rate,
  checkout_start_rate,
  purchase_conversion_rate
from marts.mart_funnel_daily
where date between @start_date and @end_date
  and (@tenant_id is null or tenant_id = @tenant_id)
  and (@locale is null or locale = @locale)
  and (@test_id is null or test_id = @test_id)
  and (@channel_key is null or channel_key = @channel_key)
order by date desc, tenant_id, test_id, channel_key;

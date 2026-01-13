select
  date,
  tenant_id,
  test_id,
  locale,
  channel_key,
  count(*) as row_count
from {{ ref('mart_funnel_daily') }}
group by date, tenant_id, test_id, locale, channel_key
having count(*) > 1

select
  date,
  platform,
  utm_campaign,
  count(*) as row_count
from {{ ref('mart_spend_mapped_daily') }}
group by date, platform, utm_campaign
having count(*) > 1

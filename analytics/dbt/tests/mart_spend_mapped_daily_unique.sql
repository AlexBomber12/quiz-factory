select
  date,
  utm_source,
  utm_campaign,
  count(*) as row_count
from {{ ref('mart_spend_mapped_daily') }}
group by date, utm_source, utm_campaign
having count(*) > 1

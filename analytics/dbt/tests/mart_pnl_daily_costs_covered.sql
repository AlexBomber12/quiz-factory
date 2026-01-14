with costs as (
  select
    date,
    sum(amount_eur) as total_costs_eur
  from {{ ref('stg_costs_daily') }}
  where cost_type in ('content', 'infra', 'tools', 'other')
  group by date
),
pnl_dates as (
  select distinct
    date
  from {{ ref('mart_pnl_daily') }}
)

select
  c.date,
  c.total_costs_eur
from costs c
left join pnl_dates p
  on c.date = p.date
where c.total_costs_eur > 0
  and p.date is null

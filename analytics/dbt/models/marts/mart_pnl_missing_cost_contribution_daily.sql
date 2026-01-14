{{
  config(
    materialized='view'
  )
}}

with raw_costs as (
  select
    date,
    sum(safe_cast(amount_eur as numeric)) as costs_eur
  from {{ source('raw_costs', 'costs_daily') }}
  group by date
),

pnl_costs as (
  select
    date,
    sum(
      coalesce(content_cost_eur, 0)
      + coalesce(infra_cost_eur, 0)
      + coalesce(tools_cost_eur, 0)
      + coalesce(other_cost_eur, 0)
    ) as pnl_costs_eur,
    count(*) as pnl_rows
  from {{ ref('mart_pnl_daily') }}
  group by date
)

select
  c.date,
  c.costs_eur,
  coalesce(p.pnl_costs_eur, 0) as pnl_costs_eur,
  coalesce(p.pnl_rows, 0) as pnl_rows
from raw_costs c
left join pnl_costs p
  on c.date = p.date
where c.costs_eur > 0
  and coalesce(p.pnl_costs_eur, 0) = 0

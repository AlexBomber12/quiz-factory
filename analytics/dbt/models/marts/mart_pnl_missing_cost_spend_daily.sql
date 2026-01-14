{{
  config(
    materialized='view'
  )
}}

with costs as (
  select
    date,
    sum(safe_cast(amount_eur as numeric)) as costs_eur
  from {{ source('raw_costs', 'costs_daily') }}
  group by date
),

spend as (
  select
    date,
    sum(amount_eur) as spend_eur
  from {{ ref('mart_spend_mapped_daily') }}
  group by date
),

costs_spend as (
  select
    coalesce(c.date, s.date) as date,
    coalesce(c.costs_eur, 0) as costs_eur,
    coalesce(s.spend_eur, 0) as spend_eur
  from costs c
  full join spend s
    on c.date = s.date
),

pnl_dates as (
  select distinct
    date
  from {{ ref('mart_pnl_daily') }}
)

select
  cs.date,
  cs.costs_eur,
  cs.spend_eur
from costs_spend cs
left join pnl_dates p
  on cs.date = p.date
where cs.costs_eur + cs.spend_eur > 0
  and p.date is null

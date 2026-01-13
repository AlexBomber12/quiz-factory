{{
  config(
    materialized='view'
  )
}}

with spend as (
  select
    date,
    utm_source,
    utm_campaign,
    amount_eur
  from {{ ref('mart_spend_mapped_daily') }}
  where utm_campaign is not null
),

collisions as (
  select
    date,
    utm_campaign,
    count(distinct utm_source) as utm_source_count,
    array_agg(distinct utm_source order by utm_source) as utm_sources,
    sum(amount_eur) as total_amount_eur
  from spend
  where utm_source is not null
  group by date, utm_campaign
  having count(distinct utm_source) > 1
)

select *
from collisions

{{
  config(
    materialized='incremental',
    unique_key=['date', 'cost_type', 'tenant_id', 'locale', 'notes'],
    partition_by={'field': 'date', 'data_type': 'date'},
    cluster_by=['cost_type', 'tenant_id']
  )
}}

with source as (
  select
    cast(date as date) as date,
    lower(cost_type) as cost_type,
    safe_cast(amount_eur as numeric) as amount_eur,
    tenant_id,
    locale,
    notes
  from {{ source('raw_costs', 'costs_daily') }}
),
filtered as (
  select *
  from source
  {% if is_incremental() %}
  where date > (
    select coalesce(max(date), date('1900-01-01'))
    from {{ this }}
  )
  {% endif %}
)

select *
from filtered

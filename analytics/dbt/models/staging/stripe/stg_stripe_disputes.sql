{{
  config(
    materialized='incremental',
    unique_key='dispute_id',
    partition_by={'field': 'created_utc', 'data_type': 'timestamp'},
    cluster_by=['dispute_id', 'purchase_id']
  )
}}

with source as (
  select
    dispute_id,
    purchase_id,
    created_utc,
    safe_cast(amount_eur as numeric) as amount_eur,
    status,
    'stripe' as provider,
    'eur' as currency
  from {{ source('raw_stripe', 'disputes') }}
),
filtered as (
  select *
  from source
  {% if is_incremental() %}
  where created_utc > (
    select coalesce(max(created_utc), timestamp('1900-01-01'))
    from {{ this }}
  )
  {% endif %}
)

select *
from filtered

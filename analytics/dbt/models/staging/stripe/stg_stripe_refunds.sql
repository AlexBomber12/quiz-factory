{{
  config(
    materialized='incremental',
    unique_key='refund_id',
    partition_by={'field': 'created_utc', 'data_type': 'timestamp'},
    cluster_by=['refund_id', 'purchase_id']
  )
}}

with source as (
  select
    refund_id,
    purchase_id,
    created_utc,
    safe_cast(amount_eur as numeric) as amount_eur,
    status,
    'stripe' as provider,
    'eur' as currency
  from {{ source('raw_stripe', 'refunds') }}
),
filtered as (
  select *
  from source
  {% if is_incremental() %}
  where created_utc >= (
    select timestamp_sub(
      coalesce(max(created_utc), timestamp('1900-01-01')),
      interval {{ var("incremental_lookback_days") }} day
    )
    from {{ this }}
  )
  {% endif %}
)

select *
from filtered

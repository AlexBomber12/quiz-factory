{{
  config(
    materialized='incremental',
    unique_key='balance_transaction_id',
    partition_by={'field': 'created_utc', 'data_type': 'timestamp'},
    cluster_by=['balance_transaction_id', 'purchase_id']
  )
}}

with source as (
  select
    purchase_id,
    balance_transaction_id,
    created_utc,
    safe_cast(fee_eur as numeric) as fee_eur,
    safe_cast(net_eur as numeric) as net_eur,
    'stripe' as provider,
    'eur' as currency
  from {{ source('raw_stripe', 'fees') }}
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

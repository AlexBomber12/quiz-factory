{{
  config(
    materialized='incremental',
    unique_key='purchase_id',
    partition_by={'field': 'created_utc', 'data_type': 'timestamp'},
    cluster_by=['purchase_id', 'tenant_id']
  )
}}

with source as (
  select
    purchase_id,
    lower(provider) as provider,
    created_utc,
    safe_cast(amount_eur as numeric) as amount_eur,
    lower(currency) as currency,
    status,
    product_type,
    is_upsell,
    tenant_id,
    test_id,
    session_id,
    distinct_id,
    locale,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
    fbclid,
    gclid,
    ttclid,
    stripe_customer_id,
    stripe_payment_intent_id
  from {{ source('raw_stripe', 'purchases') }}
  where lower(currency) = 'eur'
    and lower(provider) = 'stripe'
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

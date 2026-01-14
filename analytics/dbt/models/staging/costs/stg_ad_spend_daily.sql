{{
  config(
    materialized='incremental',
    unique_key=['date', 'platform', 'account_id', 'campaign_id'],
    partition_by={'field': 'date', 'data_type': 'date'},
    cluster_by=['platform', 'account_id']
  )
}}

with source as (
  select
    cast(date as date) as date,
    {{ normalize_utm_source('platform') }} as platform,
    {{ normalize_utm_source('platform') }} as utm_source,
    account_id,
    campaign_id,
    campaign_name,
    utm_campaign,
    safe_cast(amount_eur as numeric) as amount_eur,
    safe_cast(impressions as int64) as impressions,
    safe_cast(clicks as int64) as clicks
  from {{ source('raw_costs', 'ad_spend_daily') }}
),
filtered as (
  select *
  from source
  {% if is_incremental() %}
  where date >= (
    select date_sub(
      coalesce(max(date), date('1900-01-01')),
      interval {{ var("incremental_lookback_days") }} day
    )
    from {{ this }}
  )
  {% endif %}
)

select *
from filtered

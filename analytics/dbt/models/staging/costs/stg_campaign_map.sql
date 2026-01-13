{{
  config(
    materialized='incremental',
    unique_key=['platform', 'account_id', 'campaign_id', 'valid_from'],
    partition_by={'field': 'valid_from', 'data_type': 'date'},
    cluster_by=['platform', 'account_id', 'campaign_id']
  )
}}

with source as (
  select
    {{ normalize_utm_source('platform') }} as platform,
    account_id,
    campaign_id,
    utm_campaign,
    cast(valid_from as date) as valid_from,
    cast(valid_to as date) as valid_to,
    notes
  from {{ source('raw_costs', 'campaign_map') }}
),
filtered as (
  select *
  from source
  {% if is_incremental() %}
  where valid_from > (
    select coalesce(max(valid_from), date('1900-01-01'))
    from {{ this }}
  )
  {% endif %}
)

select *
from filtered

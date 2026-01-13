{{
  config(
    materialized='incremental',
    unique_key='event_uuid',
    partition_by={'field': 'timestamp_utc', 'data_type': 'timestamp'},
    cluster_by=['event_name', 'distinct_id']
  )
}}

with source as (
  select
    uuid as event_uuid,
    lower(event) as event_name,
    distinct_id,
    coalesce(
      safe_cast(json_value(properties, '$.timestamp_utc') as timestamp),
      timestamp
    ) as timestamp_utc,
    json_value(properties, '$.tenant_id') as tenant_id,
    json_value(properties, '$.test_id') as test_id,
    json_value(properties, '$.session_id') as session_id,
    json_value(properties, '$.locale') as locale,
    json_value(properties, '$.device_type') as device_type,
    {{ normalize_utm_source("json_value(properties, '$.utm_source')") }}
      as utm_source,
    json_value(properties, '$.utm_medium') as utm_medium,
    json_value(properties, '$.utm_campaign') as utm_campaign,
    json_value(properties, '$.utm_content') as utm_content,
    json_value(properties, '$.utm_term') as utm_term,
    json_value(properties, '$.fbclid') as fbclid,
    json_value(properties, '$.gclid') as gclid,
    json_value(properties, '$.ttclid') as ttclid,
    json_value(properties, '$.referrer') as referrer,
    json_value(properties, '$.purchase_id') as purchase_id,
    safe_cast(json_value(properties, '$.amount_eur') as numeric) as amount_eur,
    safe_cast(json_value(properties, '$.is_internal') as bool) as is_internal
  from {{ source('raw_posthog', 'events') }}
),
filtered as (
  select *
  from source
  {% if is_incremental() %}
  where timestamp_utc > (
    select coalesce(max(timestamp_utc), timestamp('1900-01-01'))
    from {{ this }}
  )
  {% endif %}
)

select *
from filtered

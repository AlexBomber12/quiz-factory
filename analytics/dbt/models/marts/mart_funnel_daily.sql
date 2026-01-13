{{
  config(
    materialized='incremental',
    unique_key=['date', 'tenant_id', 'test_id', 'locale', 'channel_key'],
    partition_by={'field': 'date', 'data_type': 'date'},
    cluster_by=['tenant_id', 'test_id', 'locale', 'channel_key']
  )
}}

{% set incremental_date %}
(
  select date_sub(
    coalesce(max(date), date('1900-01-01')),
    interval {{ var("incremental_lookback_days") }} day
  )
  from {{ this }}
)
{% endset %}

with events_base as (
  select
    date(timestamp_utc, '{{ var("reporting_timezone") }}') as date,
    tenant_id,
    test_id,
    locale,
    distinct_id,
    session_id,
    event_name,
    referrer,
    utm_source,
    utm_campaign
  from {{ ref('stg_posthog_events') }}
  where event_name in (
    'page_view',
    'test_start',
    'test_complete',
    'paywall_view',
    'checkout_start',
    'purchase_success'
  )
    and coalesce(is_internal, false) = false
  {% if is_incremental() %}
    and date(timestamp_utc, '{{ var("reporting_timezone") }}') >= {{ incremental_date }}
  {% endif %}
),

attributed as (
  select
    date,
    tenant_id,
    test_id,
    locale,
    distinct_id,
    session_id,
    event_name,
    case
      when nullif(trim(utm_source), '') is not null
        or nullif(trim(utm_campaign), '') is not null then
        lower(
          concat(
            coalesce(nullif(trim(utm_source), ''), 'unknown'),
            ':',
            coalesce(nullif(trim(utm_campaign), ''), 'unknown')
          )
        )
      when nullif(trim(referrer), '') is null then 'direct'
      when regexp_contains(
        lower(referrer),
        r'(google\\.|bing\\.|yahoo\\.|duckduckgo\\.|yandex\\.|baidu\\.)'
      ) then 'organic'
      else 'referral'
    end as channel_key
  from events_base
),

aggregated as (
  select
    date,
    tenant_id,
    test_id,
    locale,
    channel_key,
    count(distinct case when event_name = 'page_view' then session_id end) as visits,
    count(distinct case when event_name = 'page_view' then distinct_id end) as unique_visitors,
    count(distinct case when event_name = 'test_start' then session_id end) as test_starts,
    count(distinct case when event_name = 'test_complete' then session_id end) as test_completes,
    count(distinct case when event_name = 'paywall_view' then session_id end) as paywall_views,
    count(distinct case when event_name = 'checkout_start' then session_id end) as checkout_starts,
    count(distinct case when event_name = 'purchase_success' then session_id end) as purchases
  from attributed
  group by date, tenant_id, test_id, locale, channel_key
)

select
  date,
  tenant_id,
  test_id,
  locale,
  channel_key,
  visits,
  unique_visitors,
  test_starts,
  test_completes,
  paywall_views,
  checkout_starts,
  purchases,
  safe_divide(test_starts, visits) as test_start_rate,
  safe_divide(test_completes, test_starts) as test_complete_rate,
  safe_divide(paywall_views, test_completes) as paywall_view_rate,
  safe_divide(checkout_starts, paywall_views) as checkout_start_rate,
  safe_divide(purchases, visits) as purchase_conversion_rate
from aggregated

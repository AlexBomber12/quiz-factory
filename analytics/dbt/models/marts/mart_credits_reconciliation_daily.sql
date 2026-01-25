{{
  config(
    materialized='incremental',
    unique_key=['date', 'tenant_id'],
    partition_by={'field': 'date', 'data_type': 'date'},
    cluster_by=['tenant_id'],
    on_schema_change='append_new_columns'
  )
}}

{% set guard_lookback_days = var("credits_guard_lookback_days") %}
{% set overage_allowance = var("credits_guard_overage_allowance") %}

{% set incremental_date %}
(
  select date_sub(
    coalesce(max(date), date('1900-01-01')),
    interval {{ var("incremental_lookback_days") }} day
  )
  from {{ this }}
)
{% endset %}

{% set guard_start_date %}
date_sub({{ incremental_date }}, interval {{ guard_lookback_days }} day)
{% endset %}

with grants_source as (
  select
    date(created_utc, '{{ var("reporting_timezone") }}') as date,
    tenant_id,
    cast(
      coalesce(credits_granted, {{ normalize_pack_size("product_type") }}, 0) as int64
    ) as credits_granted_effective
  from {{ ref('stg_stripe_purchases') }}
  {% if is_incremental() %}
    where date(created_utc, '{{ var("reporting_timezone") }}') >= {{ guard_start_date }}
  {% endif %}
),

grants_daily as (
  select
    date,
    tenant_id,
    sum(credits_granted_effective) as credits_granted_total
  from grants_source
  group by date, tenant_id
),

consumption_source as (
  select
    date(timestamp_utc, '{{ var("reporting_timezone") }}') as date,
    tenant_id
  from {{ ref('stg_posthog_events') }}
  where event_name = 'report_view'
    and consumed_credit = true
    and coalesce(is_internal, false) = false
  {% if is_incremental() %}
    and date(timestamp_utc, '{{ var("reporting_timezone") }}') >= {{ guard_start_date }}
  {% endif %}
),

consumption_daily as (
  select
    date,
    tenant_id,
    count(*) as credits_consumed_total
  from consumption_source
  group by date, tenant_id
),

all_keys as (
  select date, tenant_id from grants_daily
  union distinct
  select date, tenant_id from consumption_daily
),

daily_joined as (
  select
    k.date,
    k.tenant_id,
    coalesce(g.credits_granted_total, 0) as credits_granted_total,
    coalesce(c.credits_consumed_total, 0) as credits_consumed_total
  from all_keys k
  left join grants_daily g
    on k.date = g.date
    and k.tenant_id = g.tenant_id
  left join consumption_daily c
    on k.date = c.date
    and k.tenant_id = c.tenant_id
),

with_rollups as (
  select
    date,
    tenant_id,
    credits_granted_total,
    credits_consumed_total,
    credits_granted_total - credits_consumed_total as credits_delta,
    sum(credits_granted_total) over (
      partition by tenant_id
      order by date
      range between interval {{ guard_lookback_days }} day preceding and current row
    ) as credits_granted_lookback_total,
    sum(credits_consumed_total) over (
      partition by tenant_id
      order by date
      range between interval {{ guard_lookback_days }} day preceding and current row
    ) as credits_consumed_lookback_total
  from daily_joined
)

select
  date,
  tenant_id,
  credits_granted_total,
  credits_consumed_total,
  credits_delta,
  credits_granted_lookback_total,
  credits_consumed_lookback_total,
  credits_consumed_lookback_total - credits_granted_lookback_total
    as credits_over_consumed_lookback,
  credits_consumed_lookback_total > credits_granted_lookback_total + {{ overage_allowance }}
    as has_credits_anomaly
from with_rollups
{% if is_incremental() %}
where date >= {{ incremental_date }}
{% endif %}

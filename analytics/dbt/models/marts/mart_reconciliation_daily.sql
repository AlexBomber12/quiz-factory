{{
  config(
    materialized='incremental',
    unique_key='date',
    partition_by={'field': 'date', 'data_type': 'date'}
  )
}}

{% set incremental_date %}
(select coalesce(max(date), date('1900-01-01')) from {{ this }})
{% endset %}

with stripe as (
  select
    date(created_utc, '{{ var("reporting_timezone") }}') as date,
    count(*) as stripe_purchase_count,
    sum(amount_eur) as stripe_gross_revenue_eur
  from {{ ref('stg_stripe_purchases') }}
  {% if is_incremental() %}
    where date(created_utc, '{{ var("reporting_timezone") }}') >= {{ incremental_date }}
  {% endif %}
  group by date
),

events as (
  select
    date(timestamp_utc, '{{ var("reporting_timezone") }}') as date,
    count(*) as event_purchase_count,
    sum(amount_eur) as event_gross_revenue_eur
  from {{ ref('stg_posthog_events') }}
  where event_name = 'purchase_success'
    and coalesce(is_internal, false) = false
  {% if is_incremental() %}
    and date(timestamp_utc, '{{ var("reporting_timezone") }}') >= {{ incremental_date }}
  {% endif %}
  group by date
)

select
  coalesce(s.date, e.date) as date,
  s.stripe_purchase_count,
  s.stripe_gross_revenue_eur,
  e.event_purchase_count,
  e.event_gross_revenue_eur,
  s.stripe_purchase_count - e.event_purchase_count as purchase_count_diff,
  s.stripe_gross_revenue_eur - e.event_gross_revenue_eur as gross_revenue_diff_eur,
  safe_divide(
    s.stripe_purchase_count - e.event_purchase_count,
    s.stripe_purchase_count
  ) as purchase_count_diff_pct,
  safe_divide(
    s.stripe_gross_revenue_eur - e.event_gross_revenue_eur,
    s.stripe_gross_revenue_eur
  ) as gross_revenue_diff_pct
from stripe s
full outer join events e on s.date = e.date

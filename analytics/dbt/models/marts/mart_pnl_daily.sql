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

with purchase_events as (
  select
    purchase_id,
    session_id,
    tenant_id,
    test_id,
    locale,
    utm_source,
    utm_campaign,
    referrer,
    timestamp_utc
  from {{ ref('stg_posthog_events') }}
  where event_name = 'purchase_success'
    and coalesce(is_internal, false) = false
  {% if is_incremental() %}
    and date(timestamp_utc, '{{ var("reporting_timezone") }}') >= {{ incremental_date }}
  {% endif %}
),

purchase_events_by_id as (
  select *
  from purchase_events
  where purchase_id is not null
  qualify row_number() over (
    partition by purchase_id
    order by timestamp_utc desc
  ) = 1
),

purchase_events_by_session as (
  select *
  from purchase_events
  where session_id is not null
  qualify row_number() over (
    partition by session_id
    order by timestamp_utc desc
  ) = 1
),

purchases as (
  select
    purchase_id,
    session_id,
    created_utc,
    amount_eur,
    tenant_id,
    test_id,
    locale,
    utm_source,
    utm_campaign
  from {{ ref('stg_stripe_purchases') }}
  {% if is_incremental() %}
    where date(created_utc, '{{ var("reporting_timezone") }}') >= {{ incremental_date }}
  {% endif %}
),

purchase_attribution as (
  select
    p.purchase_id,
    p.session_id,
    date(p.created_utc, '{{ var("reporting_timezone") }}') as purchase_date,
    p.amount_eur,
    coalesce(e_by_id.tenant_id, e_by_session.tenant_id, p.tenant_id) as tenant_id,
    coalesce(e_by_id.test_id, e_by_session.test_id, p.test_id) as test_id,
    coalesce(e_by_id.locale, e_by_session.locale, p.locale) as locale,
    {{ normalize_utm_source(
      "coalesce(e_by_id.utm_source, e_by_session.utm_source, p.utm_source)"
    ) }} as utm_source,
    coalesce(e_by_id.utm_campaign, e_by_session.utm_campaign, p.utm_campaign) as utm_campaign,
    coalesce(e_by_id.referrer, e_by_session.referrer) as referrer
  from purchases p
  left join purchase_events_by_id e_by_id on p.purchase_id = e_by_id.purchase_id
  left join purchase_events_by_session e_by_session on p.session_id = e_by_session.session_id
),

purchase_attribution_channel as (
  select
    *,
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
  from purchase_attribution
),

refunds as (
  select
    refund_id,
    purchase_id,
    date(created_utc, '{{ var("reporting_timezone") }}') as refund_date,
    amount_eur
  from {{ ref('stg_stripe_refunds') }}
  {% if is_incremental() %}
    where date(created_utc, '{{ var("reporting_timezone") }}') >= {{ incremental_date }}
  {% endif %}
),

disputes as (
  select
    dispute_id,
    purchase_id,
    date(created_utc, '{{ var("reporting_timezone") }}') as dispute_date,
    amount_eur
  from {{ ref('stg_stripe_disputes') }}
  {% if is_incremental() %}
    where date(created_utc, '{{ var("reporting_timezone") }}') >= {{ incremental_date }}
  {% endif %}
),

fees as (
  select
    balance_transaction_id,
    purchase_id,
    date(created_utc, '{{ var("reporting_timezone") }}') as fee_date,
    fee_eur
  from {{ ref('stg_stripe_fees') }}
  {% if is_incremental() %}
    where date(created_utc, '{{ var("reporting_timezone") }}') >= {{ incremental_date }}
  {% endif %}
),

fact_rows as (
  select
    purchase_date as date,
    tenant_id,
    test_id,
    locale,
    channel_key,
    amount_eur as gross_revenue_eur,
    cast(0 as numeric) as refunds_eur,
    cast(0 as numeric) as disputes_eur,
    cast(0 as numeric) as payment_fees_eur
  from purchase_attribution_channel

  union all

  select
    refund_date as date,
    p.tenant_id,
    p.test_id,
    p.locale,
    p.channel_key,
    cast(0 as numeric) as gross_revenue_eur,
    r.amount_eur as refunds_eur,
    cast(0 as numeric) as disputes_eur,
    cast(0 as numeric) as payment_fees_eur
  from refunds r
  left join purchase_attribution_channel p on r.purchase_id = p.purchase_id

  union all

  select
    dispute_date as date,
    p.tenant_id,
    p.test_id,
    p.locale,
    p.channel_key,
    cast(0 as numeric) as gross_revenue_eur,
    cast(0 as numeric) as refunds_eur,
    d.amount_eur as disputes_eur,
    cast(0 as numeric) as payment_fees_eur
  from disputes d
  left join purchase_attribution_channel p on d.purchase_id = p.purchase_id

  union all

  select
    fee_date as date,
    p.tenant_id,
    p.test_id,
    p.locale,
    p.channel_key,
    cast(0 as numeric) as gross_revenue_eur,
    cast(0 as numeric) as refunds_eur,
    cast(0 as numeric) as disputes_eur,
    f.fee_eur as payment_fees_eur
  from fees f
  left join purchase_attribution_channel p on f.purchase_id = p.purchase_id
),

pnl_base as (
  select
    date,
    tenant_id,
    test_id,
    locale,
    channel_key,
    sum(gross_revenue_eur) as gross_revenue_eur,
    sum(refunds_eur) as refunds_eur,
    sum(disputes_eur) as disputes_eur,
    sum(payment_fees_eur) as payment_fees_eur,
    sum(gross_revenue_eur)
      - sum(refunds_eur)
      - sum(disputes_eur)
      - sum(payment_fees_eur) as net_revenue_eur
  from fact_rows
  group by date, tenant_id, test_id, locale, channel_key
),

funnel_visits as (
  select
    date,
    tenant_id,
    test_id,
    locale,
    channel_key,
    visits
  from {{ ref('mart_funnel_daily') }}
  {% if is_incremental() %}
    where date >= {{ incremental_date }}
  {% endif %}
),

tenant_visits as (
  select
    date,
    tenant_id,
    sum(visits) as visits
  from funnel_visits
  group by date, tenant_id
),

tenant_locale_visits as (
  select
    date,
    tenant_id,
    locale,
    sum(visits) as visits
  from funnel_visits
  group by date, tenant_id, locale
),

total_visits as (
  select
    date,
    sum(visits) as visits
  from tenant_visits
  group by date
),

direct_costs as (
  select
    date,
    cost_type,
    amount_eur,
    tenant_id,
    locale
  from {{ ref('stg_costs_daily') }}
  where tenant_id is not null
  {% if is_incremental() %}
    and date >= {{ incremental_date }}
  {% endif %}
),

shared_costs as (
  select
    date,
    cost_type,
    amount_eur
  from {{ ref('stg_costs_daily') }}
  where tenant_id is null
    and cost_type in ('infra', 'tools')
  {% if is_incremental() %}
    and date >= {{ incremental_date }}
  {% endif %}
),

direct_costs_allocated as (
  select
    f.date,
    f.tenant_id,
    f.test_id,
    f.locale,
    f.channel_key,
    c.cost_type,
    c.amount_eur
      * safe_divide(
          f.visits,
          case
            when c.locale is null then tv.visits
            else tlv.visits
          end
        ) as amount_eur
  from direct_costs c
  join funnel_visits f
    on c.date = f.date
    and c.tenant_id = f.tenant_id
    and (c.locale is null or c.locale = f.locale)
  left join tenant_visits tv
    on f.date = tv.date
    and f.tenant_id = tv.tenant_id
  left join tenant_locale_visits tlv
    on f.date = tlv.date
    and f.tenant_id = tlv.tenant_id
    and f.locale = tlv.locale
  where case
    when c.locale is null then coalesce(tv.visits, 0)
    else coalesce(tlv.visits, 0)
  end > 0
),

direct_costs_unallocated as (
  select
    c.date,
    c.tenant_id,
    '__unallocated__' as test_id,
    coalesce(c.locale, '__unallocated__') as locale,
    '__unallocated__' as channel_key,
    c.cost_type,
    c.amount_eur as amount_eur
  from direct_costs c
  left join tenant_visits tv
    on c.date = tv.date
    and c.tenant_id = tv.tenant_id
  left join tenant_locale_visits tlv
    on c.date = tlv.date
    and c.tenant_id = tlv.tenant_id
    and c.locale = tlv.locale
  where case
    when c.locale is null then coalesce(tv.visits, 0)
    else coalesce(tlv.visits, 0)
  end = 0
),

shared_costs_allocated as (
  select
    f.date,
    f.tenant_id,
    f.test_id,
    f.locale,
    f.channel_key,
    c.cost_type,
    c.amount_eur * safe_divide(f.visits, tv.visits) as amount_eur
  from shared_costs c
  join funnel_visits f
    on c.date = f.date
  left join total_visits tv
    on f.date = tv.date
  where coalesce(tv.visits, 0) > 0
),

shared_costs_unallocated as (
  select
    c.date,
    '__unallocated__' as tenant_id,
    '__unallocated__' as test_id,
    '__unallocated__' as locale,
    '__unallocated__' as channel_key,
    c.cost_type,
    c.amount_eur as amount_eur
  from shared_costs c
  left join total_visits tv
    on c.date = tv.date
  where coalesce(tv.visits, 0) = 0
),

costs_allocated as (
  select *
  from direct_costs_allocated

  union all

  select *
  from direct_costs_unallocated

  union all

  select *
  from shared_costs_allocated

  union all

  select *
  from shared_costs_unallocated
),

costs_by_key as (
  select
    date,
    tenant_id,
    test_id,
    locale,
    channel_key,
    sum(case when cost_type = 'content' then amount_eur else 0 end) as content_cost_eur,
    sum(case when cost_type = 'infra' then amount_eur else 0 end) as infra_cost_eur,
    sum(case when cost_type = 'tools' then amount_eur else 0 end) as tools_cost_eur,
    sum(case when cost_type = 'other' then amount_eur else 0 end) as other_cost_eur
  from costs_allocated
  group by date, tenant_id, test_id, locale, channel_key
),

spend_by_campaign as (
  select
    date,
    utm_source,
    utm_campaign,
    sum(amount_eur) as ad_spend_eur
  from {{ ref('mart_spend_mapped_daily') }}
  {% if is_incremental() %}
    where date >= {{ incremental_date }}
  {% endif %}
  group by date, utm_source, utm_campaign
),

purchase_keys as (
  select
    purchase_date as date,
    tenant_id,
    test_id,
    locale,
    channel_key
  from purchase_attribution_channel
),

cost_keys as (
  select
    date,
    tenant_id,
    test_id,
    locale,
    channel_key
  from costs_allocated
),

base_keys as (
  select
    date,
    tenant_id,
    test_id,
    locale,
    channel_key
  from pnl_base

  union distinct

  select
    date,
    tenant_id,
    test_id,
    locale,
    channel_key
  from funnel_visits

  union distinct

  select
    date,
    tenant_id,
    test_id,
    locale,
    channel_key
  from purchase_keys

  union distinct

  select
    date,
    tenant_id,
    test_id,
    locale,
    channel_key
  from cost_keys
),

spend_keys as (
  select
    s.date,
    '__unallocated__' as tenant_id,
    '__unallocated__' as test_id,
    '__unallocated__' as locale,
    lower(
      concat(
        coalesce(nullif(trim(s.utm_source), ''), 'unknown'),
        ':',
        coalesce(nullif(trim(s.utm_campaign), ''), 'unknown')
      )
    ) as channel_key
  from spend_by_campaign s
  left join base_keys b
    on s.date = b.date
    and lower(
      concat(
        coalesce(nullif(trim(s.utm_source), ''), 'unknown'),
        ':',
        coalesce(nullif(trim(s.utm_campaign), ''), 'unknown')
      )
    ) = b.channel_key
  where b.date is null
),

all_keys as (
  select
    date,
    tenant_id,
    test_id,
    locale,
    channel_key
  from base_keys

  union distinct

  select
    date,
    tenant_id,
    test_id,
    locale,
    channel_key
  from spend_keys
),

keys_with_campaign as (
  select
    date,
    tenant_id,
    test_id,
    locale,
    channel_key,
    case
      when channel_key in ('direct', 'organic', 'referral') then null
      when strpos(channel_key, ':') > 0
        then split(channel_key, ':')[safe_offset(0)]
      else null
    end as utm_source,
    case
      when channel_key in ('direct', 'organic', 'referral') then null
      when strpos(channel_key, ':') > 0
        then split(channel_key, ':')[safe_offset(1)]
      else null
    end as utm_campaign
  from all_keys
)

select
  k.date,
  k.tenant_id,
  k.test_id,
  k.locale,
  k.channel_key,
  coalesce(p.gross_revenue_eur, 0) as gross_revenue_eur,
  coalesce(p.refunds_eur, 0) as refunds_eur,
  coalesce(p.disputes_eur, 0) as disputes_eur,
  coalesce(p.payment_fees_eur, 0) as payment_fees_eur,
  coalesce(p.net_revenue_eur, 0) as net_revenue_eur,
  coalesce(s.ad_spend_eur, 0) as ad_spend_eur,
  coalesce(c.content_cost_eur, 0) as content_cost_eur,
  coalesce(c.infra_cost_eur, 0) as infra_cost_eur,
  coalesce(c.tools_cost_eur, 0) as tools_cost_eur,
  coalesce(c.other_cost_eur, 0) as other_cost_eur,
  coalesce(p.net_revenue_eur, 0)
    - coalesce(s.ad_spend_eur, 0)
    - coalesce(c.content_cost_eur, 0)
    - coalesce(c.infra_cost_eur, 0)
    - coalesce(c.tools_cost_eur, 0)
    - coalesce(c.other_cost_eur, 0) as contribution_margin_eur
from keys_with_campaign k
left join pnl_base p
  on k.date = p.date
  and k.tenant_id = p.tenant_id
  and k.test_id = p.test_id
  and k.locale = p.locale
  and k.channel_key = p.channel_key
left join costs_by_key c
  on k.date = c.date
  and k.tenant_id = c.tenant_id
  and k.test_id = c.test_id
  and k.locale = c.locale
  and k.channel_key = c.channel_key
left join spend_by_campaign s
  on k.date = s.date
  and k.utm_source = s.utm_source
  and k.utm_campaign = s.utm_campaign

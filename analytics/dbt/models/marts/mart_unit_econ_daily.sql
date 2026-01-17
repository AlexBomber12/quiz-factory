{{
  config(
    materialized='incremental',
    unique_key=['date', 'tenant_id', 'test_id', 'locale', 'channel_key'],
    partition_by={'field': 'date', 'data_type': 'date'},
    cluster_by=['tenant_id', 'test_id', 'locale', 'channel_key'],
    on_schema_change='append_new_columns'
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

with pnl as (
  select
    date,
    tenant_id,
    test_id,
    locale,
    channel_key,
    gross_revenue_eur,
    net_revenue_eur,
    contribution_margin_eur,
    ad_spend_eur
  from {{ ref('mart_pnl_daily') }}
  {% if is_incremental() %}
    where date >= {{ incremental_date }}
  {% endif %}
),

funnel as (
  select
    date,
    tenant_id,
    test_id,
    locale,
    channel_key,
    purchases,
    visits
  from {{ ref('mart_funnel_daily') }}
  {% if is_incremental() %}
    where date >= {{ incremental_date }}
  {% endif %}
),

offer_rollup as (
  select
    date,
    tenant_id,
    test_id,
    locale,
    channel_key,
    sum(purchases) as purchases_offer_total,
    sum(case when offer_type = 'single' then purchases else 0 end) as purchases_single,
    sum(case when offer_type = 'pack_5' then purchases else 0 end) as purchases_pack_5,
    sum(case when offer_type = 'pack_10' then purchases else 0 end) as purchases_pack_10,
    sum(case when pricing_variant = 'intro' then purchases else 0 end) as purchases_intro,
    sum(credits_sold) as credits_sold_total,
    safe_divide(sum(gross_revenue_eur), nullif(sum(credits_sold), 0))
      as effective_price_per_credit_eur
  from {{ ref('mart_offer_daily') }}
  {% if is_incremental() %}
    where date >= {{ incremental_date }}
  {% endif %}
  group by date, tenant_id, test_id, locale, channel_key
),

purchase_events as (
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
    tenant_id,
    test_id,
    locale,
    distinct_id,
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
    p.distinct_id,
    date(p.created_utc, '{{ var("reporting_timezone") }}') as purchase_date,
    coalesce(e_by_id.tenant_id, e_by_session.tenant_id, p.tenant_id) as tenant_id,
    coalesce(e_by_id.test_id, e_by_session.test_id, p.test_id) as test_id,
    coalesce(e_by_id.locale, e_by_session.locale, p.locale) as locale,
    coalesce(e_by_id.utm_source, e_by_session.utm_source, p.utm_source) as utm_source,
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

first_purchase_by_distinct as (
  select
    distinct_id,
    min(date(created_utc, '{{ var("reporting_timezone") }}')) as first_purchase_date
  from {{ ref('stg_stripe_purchases') }}
  where distinct_id is not null
  group by distinct_id
),

first_time_purchases as (
  select
    p.purchase_date as date,
    p.tenant_id,
    p.test_id,
    p.locale,
    p.channel_key,
    count(distinct p.distinct_id) as first_time_purchasers_count
  from purchase_attribution_channel p
  join first_purchase_by_distinct f
    on p.distinct_id = f.distinct_id
    and p.purchase_date = f.first_purchase_date
  {% if is_incremental() %}
    where p.purchase_date >= {{ incremental_date }}
  {% endif %}
  group by date, tenant_id, test_id, locale, channel_key
),

all_keys as (
  select
    date,
    tenant_id,
    test_id,
    locale,
    channel_key
  from pnl

  union distinct

  select
    date,
    tenant_id,
    test_id,
    locale,
    channel_key
  from funnel

  union distinct

  select
    date,
    tenant_id,
    test_id,
    locale,
    channel_key
  from first_time_purchases

  union distinct

  select
    date,
    tenant_id,
    test_id,
    locale,
    channel_key
  from offer_rollup
),

joined as (
  select
    k.date,
    k.tenant_id,
    k.test_id,
    k.locale,
    k.channel_key,
    p.gross_revenue_eur,
    p.net_revenue_eur,
    p.contribution_margin_eur,
    p.ad_spend_eur,
    f.purchases,
    f.visits,
    ftp.first_time_purchasers_count,
    o.purchases_offer_total,
    o.purchases_single,
    o.purchases_pack_5,
    o.purchases_pack_10,
    o.purchases_intro,
    o.credits_sold_total,
    o.effective_price_per_credit_eur
  from all_keys k
  left join pnl p
    on k.date = p.date
    and k.tenant_id = p.tenant_id
    and k.test_id = p.test_id
    and k.locale = p.locale
    and k.channel_key = p.channel_key
  left join funnel f
    on k.date = f.date
    and k.tenant_id = f.tenant_id
    and k.test_id = f.test_id
    and k.locale = f.locale
    and k.channel_key = f.channel_key
  left join first_time_purchases ftp
    on k.date = ftp.date
    and k.tenant_id = ftp.tenant_id
    and k.test_id = ftp.test_id
    and k.locale = ftp.locale
    and k.channel_key = ftp.channel_key
  left join offer_rollup o
    on k.date = o.date
    and k.tenant_id = o.tenant_id
    and k.test_id = o.test_id
    and k.locale = o.locale
    and k.channel_key = o.channel_key
)

select
  date,
  tenant_id,
  test_id,
  locale,
  channel_key,
  safe_divide(gross_revenue_eur, purchases) as aov_eur,
  safe_divide(contribution_margin_eur, purchases) as profit_per_purchase_eur,
  safe_divide(contribution_margin_eur, visits) as profit_per_visit_eur,
  safe_divide(ad_spend_eur, first_time_purchasers_count) as cac_eur,
  coalesce(purchases_single, 0) as purchases_single,
  coalesce(purchases_pack_5, 0) as purchases_pack_5,
  coalesce(purchases_pack_10, 0) as purchases_pack_10,
  safe_divide(
    coalesce(purchases_pack_5, 0) + coalesce(purchases_pack_10, 0),
    purchases_offer_total
  ) as pack_purchase_share,
  coalesce(credits_sold_total, 0) as credits_sold_total,
  effective_price_per_credit_eur,
  coalesce(purchases_intro, 0) as purchases_intro,
  safe_divide(coalesce(purchases_intro, 0), purchases_offer_total) as intro_purchase_share
from joined

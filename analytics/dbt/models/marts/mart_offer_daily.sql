{{
  config(
    materialized='incremental',
    unique_key=['date', 'tenant_id', 'test_id', 'locale', 'channel_key', 'offer_type', 'pricing_variant'],
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
    utm_campaign,
    product_type,
    pricing_variant
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
    p.product_type,
    p.pricing_variant as raw_pricing_variant,
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
    purchase_id,
    session_id,
    purchase_date,
    amount_eur,
    tenant_id,
    test_id,
    locale,
    utm_source,
    utm_campaign,
    referrer,
    {{ normalize_offer_type("product_type") }} as offer_type,
    {{ normalize_pack_size("product_type") }} as pack_size,
    case
      when raw_pricing_variant is null
        or nullif(trim(cast(raw_pricing_variant as string)), '') is null then 'unknown'
      else lower(trim(cast(raw_pricing_variant as string)))
    end as pricing_variant,
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
    offer_type,
    pricing_variant,
    pack_size,
    purchase_id,
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
    coalesce(p.offer_type, 'unknown') as offer_type,
    coalesce(p.pricing_variant, 'unknown') as pricing_variant,
    cast(null as int64) as pack_size,
    cast(null as string) as purchase_id,
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
    coalesce(p.offer_type, 'unknown') as offer_type,
    coalesce(p.pricing_variant, 'unknown') as pricing_variant,
    cast(null as int64) as pack_size,
    cast(null as string) as purchase_id,
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
    coalesce(p.offer_type, 'unknown') as offer_type,
    coalesce(p.pricing_variant, 'unknown') as pricing_variant,
    cast(null as int64) as pack_size,
    cast(null as string) as purchase_id,
    cast(0 as numeric) as gross_revenue_eur,
    cast(0 as numeric) as refunds_eur,
    cast(0 as numeric) as disputes_eur,
    f.fee_eur as payment_fees_eur
  from fees f
  left join purchase_attribution_channel p on f.purchase_id = p.purchase_id
),

offer_base as (
  select
    date,
    tenant_id,
    test_id,
    locale,
    channel_key,
    offer_type,
    pricing_variant,
    count(distinct purchase_id) as purchases,
    sum(gross_revenue_eur) as gross_revenue_eur,
    sum(refunds_eur) as refunds_eur,
    sum(disputes_eur) as disputes_eur,
    sum(payment_fees_eur) as payment_fees_eur,
    sum(cast(coalesce(pack_size, 0) as numeric)) as credits_sold,
    sum(gross_revenue_eur)
      - sum(refunds_eur)
      - sum(disputes_eur)
      - sum(payment_fees_eur) as net_revenue_eur
  from fact_rows
  group by date, tenant_id, test_id, locale, channel_key, offer_type, pricing_variant
)

select
  date,
  tenant_id,
  test_id,
  locale,
  channel_key,
  offer_type,
  pricing_variant,
  purchases,
  gross_revenue_eur,
  refunds_eur,
  payment_fees_eur,
  net_revenue_eur,
  credits_sold,
  safe_divide(gross_revenue_eur, nullif(credits_sold, 0)) as effective_price_per_credit_eur
from offer_base

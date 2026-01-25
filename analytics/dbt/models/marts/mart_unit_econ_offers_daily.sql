{{
  config(
    materialized='incremental',
    unique_key=[
      'date',
      'tenant_id',
      'test_id',
      'locale',
      'channel_key',
      'offer_key',
      'product_type',
      'pricing_variant'
    ],
    partition_by={'field': 'date', 'data_type': 'date'},
    cluster_by=['tenant_id', 'offer_key', 'product_type', 'pricing_variant', 'channel_key'],
    on_schema_change='append_new_columns'
  )
}}

{% set attribution_lookback_days = var("credits_attribution_lookback_days") %}

{% set incremental_date %}
(
  select date_sub(
    coalesce(max(date), date('1900-01-01')),
    interval {{ var("incremental_lookback_days") }} day
  )
  from {{ this }}
)
{% endset %}

{% set attribution_start_date %}
date_sub({{ incremental_date }}, interval {{ attribution_lookback_days }} day)
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
    offer_key,
    product_type,
    pricing_variant,
    credits_granted,
    timestamp_utc
  from {{ ref('stg_posthog_events') }}
  where event_name = 'purchase_success'
    and coalesce(is_internal, false) = false
  {% if is_incremental() %}
    and date(timestamp_utc, '{{ var("reporting_timezone") }}') >= {{ attribution_start_date }}
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

purchases_source as (
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
    offer_key,
    product_type,
    pricing_variant,
    credits_granted,
    unit_price_eur
  from {{ ref('stg_stripe_purchases') }}
  {% if is_incremental() %}
    where date(created_utc, '{{ var("reporting_timezone") }}') >= {{ attribution_start_date }}
  {% endif %}
),

purchase_attribution as (
  select
    p.purchase_id,
    p.session_id,
    date(p.created_utc, '{{ var("reporting_timezone") }}') as purchase_date,
    p.amount_eur,
    p.credits_granted,
    p.unit_price_eur,
    coalesce(e_by_id.tenant_id, e_by_session.tenant_id, p.tenant_id) as tenant_id,
    coalesce(e_by_id.test_id, e_by_session.test_id, p.test_id) as test_id,
    coalesce(e_by_id.locale, e_by_session.locale, p.locale) as locale,
    {{ normalize_utm_source(
      "coalesce(e_by_id.utm_source, e_by_session.utm_source, p.utm_source)"
    ) }} as utm_source,
    coalesce(e_by_id.utm_campaign, e_by_session.utm_campaign, p.utm_campaign)
      as utm_campaign,
    coalesce(e_by_id.referrer, e_by_session.referrer) as referrer,
    coalesce(e_by_id.offer_key, e_by_session.offer_key, p.offer_key) as raw_offer_key,
    coalesce(e_by_id.product_type, e_by_session.product_type, p.product_type)
      as raw_product_type,
    coalesce(e_by_id.pricing_variant, e_by_session.pricing_variant, p.pricing_variant)
      as raw_pricing_variant,
    coalesce(e_by_id.credits_granted, e_by_session.credits_granted, p.credits_granted)
      as raw_credits_granted
  from purchases_source p
  left join purchase_events_by_id e_by_id on p.purchase_id = e_by_id.purchase_id
  left join purchase_events_by_session e_by_session on p.session_id = e_by_session.session_id
),

purchase_attribution_channel as (
  select
    purchase_id,
    session_id,
    purchase_date,
    amount_eur,
    unit_price_eur,
    tenant_id,
    test_id,
    locale,
    utm_source,
    utm_campaign,
    referrer,
    raw_offer_key,
    raw_product_type,
    raw_pricing_variant,
    raw_credits_granted,
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

purchases_enriched as (
  select
    purchase_id,
    purchase_date as date,
    tenant_id,
    test_id,
    locale,
    channel_key,
    amount_eur,
    unit_price_eur,
    case
      when raw_offer_key is null
        or nullif(trim(cast(raw_offer_key as string)), '') is null then 'unknown'
      else lower(trim(cast(raw_offer_key as string)))
    end as offer_key,
    case
      when raw_product_type is null
        or nullif(trim(cast(raw_product_type as string)), '') is null then 'unknown'
      else lower(trim(cast(raw_product_type as string)))
    end as product_type,
    {{ normalize_offer_type("raw_product_type") }} as offer_type,
    {{ normalize_pack_size("raw_product_type") }} as pack_size,
    case
      when raw_pricing_variant is null
        or nullif(trim(cast(raw_pricing_variant as string)), '') is null then 'unknown'
      else lower(trim(cast(raw_pricing_variant as string)))
    end as pricing_variant,
    cast(
      coalesce(raw_credits_granted, {{ normalize_pack_size("raw_product_type") }}, 0) as int64
    ) as credits_granted_effective
  from purchase_attribution_channel
),

purchases_daily as (
  select
    date,
    tenant_id,
    test_id,
    locale,
    channel_key,
    offer_key,
    product_type,
    pricing_variant,
    count(distinct purchase_id) as purchases_count,
    sum(case when offer_type = 'single' then 1 else 0 end) as purchases_single_count,
    sum(case when offer_type in ('pack_5', 'pack_10') then 1 else 0 end)
      as purchases_pack_count,
    sum(coalesce(amount_eur, 0)) as revenue_eur,
    sum(credits_granted_effective) as credits_granted_total
  from purchases_enriched
  group by date, tenant_id, test_id, locale, channel_key, offer_key, product_type, pricing_variant
),

consumption_events as (
  select
    purchase_id,
    timestamp_utc,
    tenant_id,
    test_id,
    locale,
    offer_key,
    product_type,
    pricing_variant
  from {{ ref('stg_posthog_events') }}
  where event_name = 'report_view'
    and consumed_credit = true
    and coalesce(is_internal, false) = false
  {% if is_incremental() %}
    and date(timestamp_utc, '{{ var("reporting_timezone") }}') >= {{ incremental_date }}
  {% endif %}
),

consumption_attribution as (
  select
    date(e.timestamp_utc, '{{ var("reporting_timezone") }}') as date,
    coalesce(p.tenant_id, e.tenant_id) as tenant_id,
    coalesce(p.test_id, e.test_id) as test_id,
    coalesce(p.locale, e.locale) as locale,
    coalesce(p.channel_key, 'unknown') as channel_key,
    coalesce(
      p.offer_key,
      case
        when e.offer_key is null
          or nullif(trim(cast(e.offer_key as string)), '') is null then null
        else lower(trim(cast(e.offer_key as string)))
      end,
      'unknown'
    ) as offer_key,
    coalesce(
      p.product_type,
      case
        when e.product_type is null
          or nullif(trim(cast(e.product_type as string)), '') is null then null
        else lower(trim(cast(e.product_type as string)))
      end,
      'unknown'
    ) as product_type,
    coalesce(
      p.pricing_variant,
      case
        when e.pricing_variant is null
          or nullif(trim(cast(e.pricing_variant as string)), '') is null then null
        else lower(trim(cast(e.pricing_variant as string)))
      end,
      'unknown'
    ) as pricing_variant,
    1 as credits_consumed
  from consumption_events e
  left join purchases_enriched p on e.purchase_id = p.purchase_id
),

consumption_daily as (
  select
    date,
    tenant_id,
    test_id,
    locale,
    channel_key,
    offer_key,
    product_type,
    pricing_variant,
    sum(credits_consumed) as credits_consumed_total
  from consumption_attribution
  group by date, tenant_id, test_id, locale, channel_key, offer_key, product_type, pricing_variant
),

all_keys as (
  select
    date,
    tenant_id,
    test_id,
    locale,
    channel_key,
    offer_key,
    product_type,
    pricing_variant
  from purchases_daily

  union distinct

  select
    date,
    tenant_id,
    test_id,
    locale,
    channel_key,
    offer_key,
    product_type,
    pricing_variant
  from consumption_daily
),

channel_totals as (
  select
    k.date,
    k.tenant_id,
    k.test_id,
    k.locale,
    k.channel_key,
    sum(coalesce(p.revenue_eur, 0)) as channel_revenue_eur,
    sum(coalesce(c.credits_consumed_total, 0)) as channel_credits_consumed_total
  from all_keys k
  left join purchases_daily p
    on k.date = p.date
    and k.tenant_id = p.tenant_id
    and k.test_id = p.test_id
    and k.locale = p.locale
    and k.channel_key = p.channel_key
    and k.offer_key = p.offer_key
    and k.product_type = p.product_type
    and k.pricing_variant = p.pricing_variant
  left join consumption_daily c
    on k.date = c.date
    and k.tenant_id = c.tenant_id
    and k.test_id = c.test_id
    and k.locale = c.locale
    and k.channel_key = c.channel_key
    and k.offer_key = c.offer_key
    and k.product_type = c.product_type
    and k.pricing_variant = c.pricing_variant
  group by date, tenant_id, test_id, locale, channel_key
),

pnl_channel as (
  select
    date,
    tenant_id,
    test_id,
    locale,
    channel_key,
    gross_revenue_eur,
    refunds_eur,
    disputes_eur,
    payment_fees_eur,
    net_revenue_eur,
    ad_spend_eur,
    contribution_margin_eur
  from {{ ref('mart_pnl_daily') }}
  {% if is_incremental() %}
    where date >= {{ incremental_date }}
  {% endif %}
),

joined as (
  select
    k.date,
    k.tenant_id,
    k.test_id,
    k.locale,
    k.channel_key,
    k.offer_key,
    k.product_type,
    k.pricing_variant,
    coalesce(p.purchases_count, 0) as purchases_count,
    coalesce(p.purchases_single_count, 0) as purchases_single_count,
    coalesce(p.purchases_pack_count, 0) as purchases_pack_count,
    coalesce(p.revenue_eur, 0) as revenue_eur,
    coalesce(p.credits_granted_total, 0) as credits_granted_total,
    coalesce(c.credits_consumed_total, 0) as credits_consumed_total,
    coalesce(t.channel_revenue_eur, 0) as channel_revenue_eur,
    coalesce(t.channel_credits_consumed_total, 0) as channel_credits_consumed_total,
    pnl.gross_revenue_eur,
    pnl.refunds_eur,
    pnl.disputes_eur,
    pnl.payment_fees_eur,
    pnl.net_revenue_eur,
    pnl.ad_spend_eur,
    pnl.contribution_margin_eur
  from all_keys k
  left join purchases_daily p
    on k.date = p.date
    and k.tenant_id = p.tenant_id
    and k.test_id = p.test_id
    and k.locale = p.locale
    and k.channel_key = p.channel_key
    and k.offer_key = p.offer_key
    and k.product_type = p.product_type
    and k.pricing_variant = p.pricing_variant
  left join consumption_daily c
    on k.date = c.date
    and k.tenant_id = c.tenant_id
    and k.test_id = c.test_id
    and k.locale = c.locale
    and k.channel_key = c.channel_key
    and k.offer_key = c.offer_key
    and k.product_type = c.product_type
    and k.pricing_variant = c.pricing_variant
  left join channel_totals t
    on k.date = t.date
    and k.tenant_id = t.tenant_id
    and k.test_id = t.test_id
    and k.locale = t.locale
    and k.channel_key = t.channel_key
  left join pnl_channel pnl
    on k.date = pnl.date
    and k.tenant_id = pnl.tenant_id
    and k.test_id = pnl.test_id
    and k.locale = pnl.locale
    and k.channel_key = pnl.channel_key
)

select
  date,
  tenant_id,
  test_id,
  locale,
  channel_key,
  offer_key,
  product_type,
  pricing_variant,
  purchases_count,
  purchases_single_count,
  purchases_pack_count,
  revenue_eur,
  credits_granted_total,
  credits_consumed_total,
  case
    when channel_revenue_eur > 0 then safe_divide(revenue_eur, channel_revenue_eur)
    when channel_credits_consumed_total > 0 then
      safe_divide(credits_consumed_total, channel_credits_consumed_total)
    else 0
  end as allocation_share,
  coalesce(gross_revenue_eur, 0)
    * case
        when channel_revenue_eur > 0 then safe_divide(revenue_eur, channel_revenue_eur)
        when channel_credits_consumed_total > 0 then
          safe_divide(credits_consumed_total, channel_credits_consumed_total)
        else 0
      end as gross_revenue_eur,
  coalesce(refunds_eur, 0)
    * case
        when channel_revenue_eur > 0 then safe_divide(revenue_eur, channel_revenue_eur)
        when channel_credits_consumed_total > 0 then
          safe_divide(credits_consumed_total, channel_credits_consumed_total)
        else 0
      end as refunds_eur,
  coalesce(disputes_eur, 0)
    * case
        when channel_revenue_eur > 0 then safe_divide(revenue_eur, channel_revenue_eur)
        when channel_credits_consumed_total > 0 then
          safe_divide(credits_consumed_total, channel_credits_consumed_total)
        else 0
      end as disputes_eur,
  coalesce(payment_fees_eur, 0)
    * case
        when channel_revenue_eur > 0 then safe_divide(revenue_eur, channel_revenue_eur)
        when channel_credits_consumed_total > 0 then
          safe_divide(credits_consumed_total, channel_credits_consumed_total)
        else 0
      end as payment_fees_eur,
  coalesce(net_revenue_eur, 0)
    * case
        when channel_revenue_eur > 0 then safe_divide(revenue_eur, channel_revenue_eur)
        when channel_credits_consumed_total > 0 then
          safe_divide(credits_consumed_total, channel_credits_consumed_total)
        else 0
      end as net_revenue_eur,
  coalesce(ad_spend_eur, 0)
    * case
        when channel_revenue_eur > 0 then safe_divide(revenue_eur, channel_revenue_eur)
        when channel_credits_consumed_total > 0 then
          safe_divide(credits_consumed_total, channel_credits_consumed_total)
        else 0
      end as ad_spend_eur,
  coalesce(contribution_margin_eur, 0)
    * case
        when channel_revenue_eur > 0 then safe_divide(revenue_eur, channel_revenue_eur)
        when channel_credits_consumed_total > 0 then
          safe_divide(credits_consumed_total, channel_credits_consumed_total)
        else 0
      end as contribution_margin_eur,
  safe_divide(revenue_eur, nullif(credits_consumed_total, 0))
    as effective_price_per_consumed_report_eur,
  safe_divide(
    coalesce(contribution_margin_eur, 0)
      * case
          when channel_revenue_eur > 0 then safe_divide(revenue_eur, channel_revenue_eur)
          when channel_credits_consumed_total > 0 then
            safe_divide(credits_consumed_total, channel_credits_consumed_total)
          else 0
        end,
    nullif(credits_consumed_total, 0)
  ) as contribution_margin_per_consumed_report_eur
from joined
{% if is_incremental() %}
where date >= {{ incremental_date }}
{% endif %}

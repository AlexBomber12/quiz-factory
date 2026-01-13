{{
  config(
    materialized='incremental',
    unique_key=['date', 'tenant_id', 'test_id', 'locale', 'channel_key'],
    partition_by={'field': 'date', 'data_type': 'date'},
    cluster_by=['tenant_id', 'test_id', 'locale', 'channel_key']
  )
}}

{% set incremental_date %}
(select coalesce(max(date), date('1900-01-01')) from {{ this }})
{% endset %}

with pnl as (
  select
    date,
    tenant_id,
    test_id,
    locale,
    channel_key,
    gross_revenue_eur,
    net_revenue_eur
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

joined as (
  select
    coalesce(p.date, f.date) as date,
    coalesce(p.tenant_id, f.tenant_id) as tenant_id,
    coalesce(p.test_id, f.test_id) as test_id,
    coalesce(p.locale, f.locale) as locale,
    coalesce(p.channel_key, f.channel_key) as channel_key,
    p.gross_revenue_eur,
    p.net_revenue_eur,
    f.purchases,
    f.visits
  from pnl p
  full outer join funnel f
    on p.date = f.date
    and p.tenant_id = f.tenant_id
    and p.test_id = f.test_id
    and p.locale = f.locale
    and p.channel_key = f.channel_key
)

select
  date,
  tenant_id,
  test_id,
  locale,
  channel_key,
  safe_divide(gross_revenue_eur, purchases) as aov_eur,
  safe_divide(net_revenue_eur, purchases) as profit_per_purchase_eur,
  safe_divide(net_revenue_eur, visits) as profit_per_visit_eur
from joined

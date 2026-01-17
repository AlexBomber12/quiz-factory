with offer_rollup as (
  select
    date,
    tenant_id,
    test_id,
    locale,
    channel_key,
    sum(gross_revenue_eur) as gross_revenue_eur
  from {{ ref('mart_offer_daily') }}
  group by date, tenant_id, test_id, locale, channel_key
),

pnl as (
  select
    date,
    tenant_id,
    test_id,
    locale,
    channel_key,
    sum(gross_revenue_eur) as gross_revenue_eur
  from {{ ref('mart_pnl_daily') }}
  group by date, tenant_id, test_id, locale, channel_key
)

select
  coalesce(o.date, p.date) as date,
  coalesce(o.tenant_id, p.tenant_id) as tenant_id,
  coalesce(o.test_id, p.test_id) as test_id,
  coalesce(o.locale, p.locale) as locale,
  coalesce(o.channel_key, p.channel_key) as channel_key,
  o.gross_revenue_eur as offer_gross_revenue_eur,
  p.gross_revenue_eur as pnl_gross_revenue_eur,
  abs(coalesce(o.gross_revenue_eur, 0) - coalesce(p.gross_revenue_eur, 0))
    as gross_revenue_diff_eur
from offer_rollup o
full join pnl p
  on o.date = p.date
  and o.tenant_id = p.tenant_id
  and o.test_id = p.test_id
  and o.locale = p.locale
  and o.channel_key = p.channel_key
where abs(coalesce(o.gross_revenue_eur, 0) - coalesce(p.gross_revenue_eur, 0)) > 0.01

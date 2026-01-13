{{
  config(
    materialized='view'
  )
}}

with daily as (
  select
    date,
    sum(net_revenue_eur) as net_revenue_eur,
    sum(
      ad_spend_eur
      + content_cost_eur
      + infra_cost_eur
      + tools_cost_eur
      + other_cost_eur
    ) as total_costs_eur,
    sum(contribution_margin_eur) as contribution_margin_eur
  from {{ ref('mart_pnl_daily') }}
  group by date
)

select
  date,
  net_revenue_eur,
  total_costs_eur,
  contribution_margin_eur,
  net_revenue_eur - total_costs_eur as expected_contribution_margin_eur,
  contribution_margin_eur - (net_revenue_eur - total_costs_eur) as delta_eur,
  abs(contribution_margin_eur - (net_revenue_eur - total_costs_eur)) <= 0.01
    as within_tolerance
from daily

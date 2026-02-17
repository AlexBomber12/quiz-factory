# Analytics Dashboards

## Overview
- Metrics definitions follow `docs/metrics.md`.
- Use the marts date columns, which already reflect the reporting timezone.

## Data sources
- marts.mart_pnl_daily
- marts.mart_funnel_daily
- marts.mart_unit_econ_daily
- marts.mart_reconciliation_daily

## Global filters
- date range
- tenant_id
- locale
- test_id
- channel_key or utm_campaign
- device_type if present in marts

Note: marts tables currently include channel_key but not utm_campaign or device_type.

## P&L Daily Dashboard
Source: marts.mart_pnl_daily

Charts:
1) Contribution margin trend
   - Placeholder until PR-ANALYTICS-07 adds costs.
   - Use net_revenue_eur as the interim contribution_margin_eur.
2) Gross vs net revenue trend
   - gross_revenue_eur and net_revenue_eur.
3) Refund rate trend
   - refunds_eur / gross_revenue_eur.
4) Payment fees trend
   - payment_fees_eur.
5) Top tenants and top tests by net revenue
   - Bar charts for tenant_id and test_id ranked by net_revenue_eur.

## Funnel Daily Dashboard
Source: marts.mart_funnel_daily

Charts:
1) Visits, test_starts, test_completes trend
   - visits, test_starts, test_completes.
2) Paywall rate and purchase conversion trend
   - paywall_view_rate and purchase_conversion_rate.
3) Drop-off by step
   - Stacked counts for visits, test_starts, test_completes, paywall_views,
     checkout_starts, purchases.
4) Top channels by purchase conversion
   - channel_key ranked by purchase_conversion_rate.
5) Top tenants by purchase conversion
   - tenant_id ranked by purchase_conversion_rate.

## Reconciliation Dashboard
Source: marts.mart_reconciliation_daily

Table columns:
- date
- stripe_purchase_count
- stripe_gross_revenue_eur
- event_purchase_count
- event_gross_revenue_eur
- purchase_count_diff
- gross_revenue_diff_eur
- purchase_count_diff_pct
- gross_revenue_diff_pct

Conditional formatting suggestions:
- Highlight rows when purchase_count_diff exceeds 5 and gross_revenue_diff_eur
  exceeds 50.
- Highlight rows when purchase_count_diff_pct or gross_revenue_diff_pct exceeds
  0.02.

## Revenue Attribution View (Domain -> Content -> Offer)
Sources:
- marts.mart_unit_econ_offers_daily (BigQuery mode)
- stripe_purchases + stripe_refunds + stripe_disputes + stripe_fees + analytics_events (Content DB mode)

Filters:
- date range (required)
- tenant_id (optional)
- content_type (optional, currently `test`)
- content_key (optional, maps to `test_id`)

Outputs:
- stacked mix by tenant (or by content when tenant is already selected)
- table dimensions: tenant_id, content_key (`test_id`), offer_key, pricing_variant
- metrics: purchases, visits, conversion, gross_revenue_eur, refunds_eur, disputes_fees_eur, payment_fees_eur, net_revenue_eur

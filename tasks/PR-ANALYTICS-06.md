PR-ANALYTICS-06: Dashboards (P&L Daily, Funnel Daily)

Goal
- Make metrics visible without SQL and without ambiguity.

Changes
- Add docs/analytics/dashboards.md with:
  - Exact fields and filters for P&L daily dashboard
  - Exact fields and filters for Funnel daily dashboard
  - Recommended slices: tenant_id, locale, test_id, utm_campaign, device_type
  - 5 must-have charts per dashboard
- Add saved SQL queries in docs/analytics/sql:
  - pnl_daily.sql
  - funnel_daily.sql
  - top_tests.sql
  - top_tenants.sql

Success criteria
- A user can recreate both dashboards in Metabase or Looker Studio using only marts tables.
- Dashboard filters work for tenant_id, test_id, locale, channel.

PR-ANALYTICS-05: dbt Marts (P&L Daily, Funnel Daily, Unit Econ) + Data Quality

Goal
- Produce marts tables that power dashboards and make unit economics explicit.

Changes
- Add dbt staging models:
  - stg_posthog_events: extract tenant_id, test_id, session_id, locale, utm_* from properties JSON
  - stg_stripe_purchases/refunds/disputes/fees: clean and type fields
- Add marts:
  - marts.mart_funnel_daily with counts per step and conversion rates by day, tenant_id, test_id, locale, channel
  - marts.mart_pnl_daily with gross, refunds, disputes, fees, and net revenue by day, tenant_id, test_id, locale, channel
  - marts.mart_unit_econ_daily with profit per purchase, profit per visitor, CAC placeholders (ad spend joins in next PR)
- Add dbt tests:
  - not null on keys (date, tenant_id, test_id where applicable)
  - accepted values on event names
  - freshness test on raw_posthog.events

Success criteria
- dbt run builds all staging and marts models successfully in BigQuery.
- dbt test passes.
- mart_funnel_daily and mart_pnl_daily match manual spot checks for a small time window.

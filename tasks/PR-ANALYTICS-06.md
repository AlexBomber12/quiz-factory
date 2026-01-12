PR-ANALYTICS-06: Dashboards (P&L Daily, Funnel Daily) (Revised)

Read and follow AGENTS.md strictly.

Context
- dbt marts exist: mart_funnel_daily, mart_pnl_daily, mart_unit_econ_daily.
- We need reproducible dashboards that do not require ad hoc SQL.

Goal
- Make metrics visible without ambiguity.
- Provide reproducible dashboard specs that can be rebuilt in Metabase or Looker Studio using marts tables only.
- Define alerting expectations for the most important failures.

Workflow rules
- Create a new branch from main named: pr-analytics-06-dashboards
- Implement only what this task requests.
- Keep everything in English.
- Avoid using em dashes; use hyphens.

Task A: Dashboard specification docs
Create docs/analytics/dashboards.md with:
- Data sources:
  - marts.mart_pnl_daily
  - marts.mart_funnel_daily
  - marts.mart_unit_econ_daily
  - marts.mart_reconciliation_daily
- Global filters:
  - date range
  - tenant_id
  - locale
  - test_id
  - channel_key or utm_campaign
  - device_type (if present in marts)
- P&L daily dashboard:
  - 5 must-have charts:
    1) contribution_margin_eur trend (placeholder until PR-07, still show net_revenue_eur)
    2) gross vs net revenue trend
    3) refunds rate trend
    4) payment fees trend
    5) top tenants and top tests by net revenue
- Funnel daily dashboard:
  - 5 must-have charts:
    1) visits, test_starts, test_completes trend
    2) paywall_rate and purchase_conversion trend
    3) drop-off by step (stacked counts)
    4) top channels by purchase_conversion
    5) top tenants by purchase_conversion
- Reconciliation dashboard section:
  - A table showing Stripe vs events drift with conditional formatting suggestions.

Task B: Canonical SQL query library
Add docs/analytics/sql with:
- pnl_daily.sql
- funnel_daily.sql
- unit_econ_daily.sql
- reconciliation_daily.sql
Each query must:
- Select from marts tables only
- Include date filtering parameters in a clear way
- Use reporting_timezone-consistent date fields

Task C: Alerting spec
Add docs/analytics/alerts.md defining:
- What to alert on (examples):
  - No Stripe purchases ingested for 30 minutes
  - purchase conversion drops by 30% day-over-day for a top tenant
  - refund rate exceeds 5%
  - reconciliation drift exceeds threshold
  - raw_posthog.events freshness fails
- Where alerts live (placeholder ok):
  - PostHog alerts, BigQuery scheduled query alerts, or BI tool alerts
- Ownership:
  - single owner and escalation path (can be project owner)

Success criteria
- A user can recreate dashboards in Metabase or Looker Studio using only marts tables and docs.
- SQL library exists and uses marts only.
- alerts.md exists and covers at least 5 critical alerts.

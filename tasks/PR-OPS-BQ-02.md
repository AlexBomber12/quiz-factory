PR-OPS-BQ-02: Scheduled Anomaly Checks and Alerts

Read and follow AGENTS.md strictly.

Context
- Analytics is only useful if failures are detected quickly.
- We want automated anomaly detection with clear runbooks.

Goal
- Add BigQuery scheduled query templates for critical alerts.
- Provide a standard alerts table and operational documentation.

Workflow rules
- Create a new branch from main named: pr-ops-bq-02-anomaly-alerts
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.

Task A: Alerts table
- Add analytics/bigquery/alerts/create_alerts_table.sql that creates:
  - marts.alert_events
Fields:
- detected_at_utc (timestamp)
- alert_name (string)
- severity (string: info|warning|critical)
- tenant_id (string nullable)
- details_json (json)
- metric_value (numeric nullable)
- threshold_value (numeric nullable)

Task B: Alert SQL templates
- Create analytics/bigquery/alerts/ with at least:
  - alert_freshness_raw_posthog.sql
  - alert_freshness_raw_stripe.sql
  - alert_reconciliation_drift.sql
  - alert_conversion_drop.sql
  - alert_refund_spike.sql
  - alert_page_view_spike.sql

Requirements:
- Each query should append alert rows into marts.alert_events.
- Each query must be idempotent for a given day by using a deterministic alert key in details_json, or by deleting and re-inserting for the day.

Task C: Runbook
- Add docs/ops/analytics_alerts_runbook.md:
  - which scheduled queries to create
  - recommended cadence
  - how to route alerts (manual first, slack later)
  - what actions to take per alert type

Task D: Documentation
- Add docs/analytics/alerts.md updated to reference marts.alert_events and the new SQL templates.

Success criteria
- SQL templates exist for all required alert types.
- docs/ops/analytics_alerts_runbook.md exists and is actionable.
- marts.alert_events schema is stable.

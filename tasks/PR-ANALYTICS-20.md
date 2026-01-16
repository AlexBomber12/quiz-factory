PR-ANALYTICS-20: BigQuery Cost Observability and Budget Guardrails

Read and follow AGENTS.md strictly.

Context
- BigQuery is the warehouse and costs depend on bytes billed and job patterns.
- We want to measure and control analytics cost in a durable way.

Goal
- Add reproducible cost observability artifacts:
  - SQL to build daily cost tables from INFORMATION_SCHEMA
  - documentation for budgets and alerts
- Keep the solution EU-compatible:
  - Use region-eu INFORMATION_SCHEMA views.

Workflow rules
- Create a new branch from main named: pr-analytics-20-bq-cost-observability
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.

Task A: BigQuery cost models (SQL artifacts)
- Create analytics/bigquery/cost_observability/
Include:
A1) create_tables.sql
- Creates marts.mart_bq_cost_daily (partitioned by date)
- Creates marts.mart_bq_cost_jobs_recent (optional, last 7 days)

A2) populate_cost_daily.sql
- Query region-eu.INFORMATION_SCHEMA.JOBS_BY_PROJECT
- Aggregate by date:
  - total_bytes_processed
  - total_bytes_billed
  - total_slot_ms
  - job_count
  - top labels or job types if available
- Store output into marts.mart_bq_cost_daily

A3) top_jobs_recent.sql
- Extract top 50 most expensive jobs from the last 7 days
- Store into marts.mart_bq_cost_jobs_recent

Task B: Documentation and budget guardrails
- Add docs/analytics/cost_control.md with:
  - how to enable BigQuery budgets and alerts
  - recommended budget thresholds
  - query hygiene rules:
    - always filter by date partition
    - avoid full table scans in dashboards
  - how to interpret mart_bq_cost_daily

Task C: Optional scheduling instructions
- In docs, describe how to set up:
  - a BigQuery scheduled query that runs populate_cost_daily.sql daily
  - a second scheduled query for top_jobs_recent.sql weekly

Success criteria
- SQL artifacts exist and can be executed manually in BigQuery.
- docs/analytics/cost_control.md exists and is actionable.
- mart_bq_cost_daily schema is stable and partitioned.

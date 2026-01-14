PR-ANALYTICS-17: dbt Safety Checks and Cost-only Day Sanity

Read and follow AGENTS.md strictly.

Context
- Analytics pipeline is live and dbt writes staging to tmp and marts to marts.
- We want hard guards against silent regressions:
  - unexpected datasets or schemas created by dbt
  - P&L missing rows for cost-only or spend-only days

Goal
- Add dbt safety checks that fail fast when analytics integrity is at risk.

Workflow rules
- Create a new branch from main named: pr-analytics-17-dbt-safety-checks
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.

Task A: dbt dataset and schema guard
A1) Add a dbt test or a dbt operation that enforces allowed datasets
- Allowed datasets for dbt artifacts:
  - tmp
  - marts
- The check must fail if any dbt-created relation exists outside tmp and marts.

A2) Make the guard run in CI
- Ensure the guard runs as part of the standard analytics pipeline check.
- If CI runs dbt build, integrate the guard into that step.

Task B: Cost-only and spend-only day sanity checks
B1) Add a model that detects missing P&L rows for days with costs or spend
- Inputs:
  - raw_costs.costs_daily
  - marts.mart_spend_mapped_daily (or equivalent mapped spend table)
  - marts.mart_pnl_daily
- Output rows where:
  - (costs_eur + spend_eur) > 0 for a date
  - but mart_pnl_daily has no row for that date (any tenant)
- Add a dbt test asserting the model returns 0 rows.

B2) Add a model that detects negative contribution days missing from P&L
- Output rows where:
  - costs exist but contribution_margin rows are absent
- Add a dbt test asserting 0 rows.

Task C: Documentation
- Add docs/analytics/safety_checks.md describing:
  - what the guards do
  - how to debug failures
  - what to do if a dataset mismatch is detected

Success criteria
- CI fails if dbt creates relations outside tmp and marts.
- CI fails if cost-only or spend-only days are missing from mart_pnl_daily.
- docs/analytics/safety_checks.md exists and is accurate.
- All existing dbt tests still pass.

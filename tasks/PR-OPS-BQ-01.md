PR-OPS-BQ-01: BigQuery Retention and Cost Control Automation

Read and follow AGENTS.md strictly.

Context
- BigQuery datasets are in EU.
- raw datasets can grow quickly and need retention boundaries.
- We want retention that is safe, reversible, and documented.

Goal
- Codify retention policies for raw datasets and provide an operational runbook.

Workflow rules
- Create a new branch from main named: pr-ops-bq-01-retention
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.

Task A: Define retention policy
- Add docs/analytics/retention.md defining:
  - raw_posthog retention window (example: 90 days)
  - raw_stripe retention window (example: 180 days)
  - raw_costs retention (example: keep indefinitely)
  - marts retention (keep indefinitely)
- Include rationale and expected BigQuery cost impact.

Task B: Provide retention SQL artifacts
- Create analytics/bigquery/retention/ with:
  - SQL to set partition expiration for partitioned tables when possible
  - SQL to delete old partitions or rows if expiration is not applicable
- Ensure SQL is safe by default:
  - require explicit date thresholds
  - include dry-run notes in docs

Task C: Operational runbook
- Add docs/ops/bigquery_retention_runbook.md:
  - how to apply retention
  - how to verify
  - how to rollback
  - how to monitor storage growth

Success criteria
- Retention policy is documented and clear.
- SQL artifacts exist for applying retention safely.
- Runbook exists and includes verification and rollback steps.

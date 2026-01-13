PR-OPS-POSTHOG-02: Privacy Enforcement and Access Boundaries

Read and follow AGENTS.md strictly.

Context
- We have raw datasets (raw_posthog, raw_stripe, raw_costs) and marts dataset.
- We already disable GeoIP enrichment and can discard client IP data.
- We want access boundaries and a clean surface for analytics.

Goal
- Make a clear boundary between raw data and analytics-ready data.
- Provide a clean BigQuery view without sensitive columns.
- Document access recommendations and retention expectations.

Workflow rules
- Create a new branch from main named: pr-ops-posthog-02-privacy-boundaries
- Implement only what this task requests.
- Keep everything in English.
- Avoid using em dashes; use hyphens.

Task A: Create clean views in BigQuery
- Add SQL under analytics/bigquery/views to create:
  - raw_posthog.events_clean
- events_clean must:
  - exclude ip
  - exclude any user properties that may contain PII
  - keep only fields needed for dbt staging

Task B: Point dbt staging to clean views
- Update stg_posthog_events to read from raw_posthog.events_clean instead of raw_posthog.events.
- Ensure no other model selects ip.

Task C: Documentation
- Add docs/analytics/privacy.md describing:
  - Dataset access policy (recommended): raw_* restricted, marts broader.
  - What is stored where, and why.
  - Retention guidance:
    - raw_posthog can be shorter
    - marts can be longer
  - How to audit that ip is not used.

Task D: Optional retention automation (documented)
- If the repo already has a place for scheduled queries, add a documented scheduled query example to purge old rows from raw_*.
- If not, only document the steps.

Success criteria
- raw_posthog.events_clean exists and excludes ip.
- dbt staging reads from events_clean.
- privacy.md exists and explains access boundaries and retention.
- dbt build and tests pass.

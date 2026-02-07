PR-GROWTH-AB-01: Hub vs Niche Measurement (tenant_kind in events + dbt comparison marts)

Read and follow AGENTS.md strictly.

Context
- We are implementing a hybrid model: hub tenant plus niche tenants.
- We need to compare funnel and unit economics by tenant kind (hub vs niche) using the existing PostHog -> BigQuery -> dbt pipeline.
- Today events include tenant_id, but they do not include tenant_kind.

Goal
- Add tenant_kind to analytics events (hub or niche) using tenant profiles.
- Extend dbt to expose funnel metrics by tenant_kind without breaking existing marts.

Non-goals
- Do not change existing mart_funnel_daily unique keys.
- Do not add a UI dashboard in the app.

Workflow rules
- Create a new branch from main named: pr-growth-ab-01-hub-vs-niche
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.
- Run the project test gate locally before committing.

Task A: Emit tenant_kind in event properties
A1) Update AnalyticsEventProperties to include tenant_kind.
- File: apps/web/src/lib/analytics/events.ts
- Add field:
  - tenant_kind: string | null

A2) Populate tenant_kind in buildBaseEventProperties.
- File: apps/web/src/lib/analytics/events.ts
- Use resolveTenantKind(tenantId) from apps/web/src/lib/tenants/profiles.ts.
- If profiles config is missing, set tenant_kind to "hub".

Task B: Document tenant_kind in events contract
B1) Update analytics/events.json
- Add "tenant_kind" to optional_properties for every event in the contract.
- Keep formatting stable (2-space JSON, sorted lists where already used).

Task C: dbt staging includes tenant_kind
C1) Update stg_posthog_events
- File: analytics/dbt/models/staging/posthog/stg_posthog_events.sql
- Add:
  - json_value(properties, '$.tenant_kind') as tenant_kind

Task D: New marts for hub vs niche comparison
D1) Add a new mart funnel rollup by tenant_kind.
- Create: analytics/dbt/models/marts/mart_funnel_daily_by_tenant_kind.sql
- Requirements:
  - Grain: date, tenant_kind, locale, channel_key
  - Use stg_posthog_events as source.
  - Aggregate the same funnel steps as mart_funnel_daily.

D2) Add schema.yml entries
- File: analytics/dbt/models/marts/schema.yml
- Add the new model with column descriptions.

Task E: Tests
E1) Ensure scripts/ci.sh --scope analytics passes.
- Add or update a dbt test if needed to ensure tenant_kind is only hub or niche when present.

Success criteria
- scripts/ci.sh exits 0.
- Events ingested into PostHog include tenant_kind.
- marts.mart_funnel_daily_by_tenant_kind is built in CI and supports hub vs niche comparisons.

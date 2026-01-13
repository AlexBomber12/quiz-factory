PR-ANALYTICS-12: dbt Dataset Naming Fix (No tmp_tmp, No tmp_marts)

Read and follow AGENTS.md strictly.

Context
- BigQuery datasets are: raw_posthog, raw_stripe, raw_costs, tmp, marts.
- dbt is configured to use custom schemas (tmp for staging, marts for marts).
- In BigQuery, a dbt schema name effectively becomes a dataset.
- Current behavior risks creating datasets like tmp_tmp or tmp_marts depending on target.schema and +schema usage.

Goal
- Ensure dbt writes staging models into dataset tmp and marts models into dataset marts, exactly.
- Prevent schema prefix duplication.
- Keep EU location unchanged.

Workflow rules
- Create a new branch from main named: pr-analytics-12-dbt-schema
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.

Task A: Add a dbt macro to control schema naming
- Add analytics/dbt/macros/generate_schema_name.sql with a macro that:
  - Uses custom_schema_name as the final dataset when provided.
  - Uses target.schema only when custom_schema_name is not provided.

Macro requirements
- Must ensure:
  - custom_schema_name "tmp" results in dataset tmp.
  - custom_schema_name "marts" results in dataset marts.
  - No concatenation with target.schema.

Task B: Verify dbt_project.yml folder-level schema configuration
- Ensure analytics/dbt/dbt_project.yml uses folder-level schema config:
  - models/staging -> +schema: tmp
  - models/marts -> +schema: marts
- Do not change model logic.

Task C: Add a safety check
- Add a small dbt model or CI check that fails if any relations are created outside the allowed datasets:
  - allowed datasets: tmp, marts
- The check can be a dbt test query that inspects INFORMATION_SCHEMA for created relations under the target project.

Task D: Documentation
- Update docs/analytics/warehouse.md with:
  - A note that dbt writes staging to tmp and marts to marts.
  - A warning that incorrect schema name generation can create unexpected datasets.

Success criteria
- dbt compile succeeds.
- After a dbt run, staging relations exist only in tmp and marts relations exist only in marts.
- No datasets named tmp_tmp, tmp_marts, marts_tmp, or similar are created.
- Docs reflect the intended dataset layout.

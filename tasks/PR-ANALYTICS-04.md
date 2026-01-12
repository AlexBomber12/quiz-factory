PR-ANALYTICS-04: BigQuery Bootstrap, PostHog Export Wiring, dbt Scaffold (Revised)

Read and follow AGENTS.md strictly.

Context
- PR-ANALYTICS-03 created raw_stripe and tmp tables needed for Stripe ingestion.
- This PR bootstraps the remaining BigQuery datasets and PostHog export wiring, and introduces the dbt scaffold.

Goal
- Ensure raw behavioral data lands in BigQuery (PostHog events).
- Provide reproducible BigQuery setup scripts for analytics datasets and core tables.
- Create dbt scaffold for transformations.

Workflow rules
- Create a new branch from main named: pr-analytics-04-warehouse-bootstrap
- Implement only what this task requests.
- Do not commit secrets. Prefer instructions for secure auth over committed keys.
- Keep everything in English.
- Avoid using em dashes; use hyphens.
- Run the project test gate locally before committing.

Task A: BigQuery datasets (analytics)
Create datasets if missing:
- raw_posthog
- raw_costs
- marts
- tmp (if not already)

Document dataset location and policy
- Choose 1 location (EU or US) and document it in docs/analytics/warehouse.md.
- All datasets must share the same location.

Task B: BigQuery core tables (non-Stripe)
Create tables with partitioning and clustering where applicable:

B1) raw_posthog.events
- Partition by DATE(timestamp) and cluster by event and distinct_id.
- Columns must match the PostHog BigQuery export events model.
- Prefer JSON type for properties where supported.

B2) raw_costs.costs_daily
- date (date)
- cost_type (string enum: infra|content|tools|other)
- amount_eur (numeric)
- tenant_id (string nullable)
- locale (string nullable)
- notes (string nullable)

B3) raw_costs.ad_spend_daily
- date (date)
- platform (string enum: meta|tiktok|google|other)
- account_id (string)
- campaign_id (string nullable)
- campaign_name (string nullable)
- utm_campaign (string nullable)
- amount_eur (numeric)
- impressions (int64)
- clicks (int64)

B4) raw_costs.campaign_map
- platform (string)
- account_id (string)
- campaign_id (string)
- utm_campaign (string)
- valid_from (date)
- valid_to (date nullable)
- notes (string nullable)

Task C: Warehouse documentation
Add docs/analytics/warehouse.md covering:
- Datasets list and location.
- Table list and partitioning strategy.
- PostHog BigQuery batch export setup steps (events model only for now).
- Service account permissions and least privilege guidance.
- Schema evolution policy:
  - How to handle new PostHog fields and required table schema updates.
- Security guidance:
  - Do not commit service account keys.
  - Prefer GitHub Actions OIDC or secret manager, but document the current minimal path if needed.

Task D: dbt project scaffold
Create a dbt project (dbt/ or analytics/dbt/) with:
- dbt_project.yml
- packages.yml (if needed)
- models folder structure:
  - models/staging/posthog
  - models/staging/stripe
  - models/staging/costs
  - models/marts
- A profiles.yml example (do not commit real values, do not commit secrets).

Smoke checks
- Provide a minimal command in docs/analytics/warehouse.md to validate connectivity:
  - A BigQuery query that returns 10 rows from raw_posthog.events.
- dbt compile runs successfully (no models required yet beyond scaffold).

Success criteria
- Datasets raw_posthog, raw_costs, marts, tmp exist with documented location.
- raw_posthog.events exists with partitioning and clustering.
- raw_costs tables exist including campaign_map.
- docs/analytics/warehouse.md exists and is reproducible end-to-end.
- dbt project scaffold exists and dbt compile succeeds.

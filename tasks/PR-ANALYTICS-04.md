PR-ANALYTICS-04: BigQuery Bootstrap, PostHog Export Wiring, dbt Scaffold

Goal
- Ensure raw data lands in BigQuery and create the analytics project scaffold for transformations.

Changes
- Add infra/bigquery SQL (or scripts) to create datasets:
  - raw_posthog, raw_stripe, raw_costs, marts, tmp
- Add infra/bigquery SQL to create core tables with partitioning:
  - raw_posthog.events partitioned by DATE(timestamp), clustered by event and distinct_id
  - raw_costs.costs_daily and raw_costs.ad_spend_daily (partition by date)
- Add docs/analytics/warehouse.md:
  - How to create GCP service account for PostHog export
  - How to configure PostHog BigQuery batch export for events model (JSON columns preferred)
  - How to verify export by querying 10 recent rows
- Add dbt project scaffold (analytics/dbt or dbt):
  - dbt_project.yml, packages.yml, models folder structure
  - profiles.yml example (do not commit secrets)

Success criteria
- Datasets and tables can be created from the repo scripts.
- PostHog export setup is documented and reproducible.
- dbt project exists and can run a no-op compile successfully.

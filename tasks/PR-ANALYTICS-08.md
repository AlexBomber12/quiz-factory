PR-ANALYTICS-08: BigQuery EU Location Alignment and dbt Schema Fix

Read and follow AGENTS.md strictly.

Context
- BigQuery bootstrap scripts currently create datasets in US, while dbt profile defaults to EU.
- Decision: BigQuery location standard is EU.

Goal
- Align all warehouse bootstrap scripts, documentation, and dbt configuration to EU.
- Ensure dbt materialization lands marts models in the BigQuery dataset marts and staging models in tmp.
- Avoid cross-location queries by ensuring all referenced datasets for analytics are in EU.

Workflow rules
- Create a new branch from main named: pr-analytics-08-bq-eu-align
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.

Task A: Bootstrap scripts must use EU
A1) Update analytics/bigquery/warehouse_bootstrap.sql
- Set location = "EU" for:
  - raw_posthog
  - raw_costs
  - marts
  - tmp
- Keep table schemas and partitioning the same.

A2) Update analytics/bigquery/stripe_bootstrap.sql
- Ensure raw_stripe and tmp are created in EU.
- Use CREATE SCHEMA IF NOT EXISTS raw_stripe OPTIONS(location = "EU");
- Ensure tmp creation does not conflict with warehouse bootstrap.

Task B: Fix dbt output schemas to match BigQuery datasets
B1) Update analytics/dbt/dbt_project.yml
- Configure schemas by folder:
  - staging models (analytics/dbt/models/staging) must materialize into dataset tmp
  - marts models (analytics/dbt/models/marts) must materialize into dataset marts
- Keep materialized type as view unless the repo has a reason to change.

B2) Update analytics/dbt/profiles.yml defaults
- Default location must be EU.
- Default dataset can remain configurable, but must not silently point to a non-existent dataset.
- Document recommended env vars:
  - DBT_BIGQUERY_PROJECT
  - DBT_BIGQUERY_LOCATION=EU

Task C: Documentation must reflect EU as standard
- Update docs/analytics/warehouse.md:
  - Change standard location to EU.
  - Clarify that all analytics datasets must be in the same location.
  - Add a short migration note:
    - BigQuery datasets cannot change location in place.
    - If any existing datasets are in US, create a new EU analytics project or recreate datasets in EU and re-point PostHog and Stripe ingestion to EU.

Task D: Smoke checks
- Update docs smoke checks to use EU wording and correct dataset names.
- Ensure dbt compile succeeds with the new schema configuration.

Success criteria
- warehouse_bootstrap.sql and stripe_bootstrap.sql create datasets in EU.
- dbt models land in tmp and marts datasets as intended.
- docs/analytics/warehouse.md states EU as the standard and includes the migration note.
- dbt compile passes locally.

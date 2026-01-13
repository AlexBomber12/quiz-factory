# Analytics Warehouse

## Datasets and location

Use a single BigQuery location for all analytics datasets. Current standard location is EU.

Datasets:
- raw_posthog
- raw_costs
- marts
- tmp

Bootstrap with `analytics/bigquery/warehouse_bootstrap.sql`. The script sets the dataset location to EU for all datasets.

dbt writes staging models to the tmp dataset and marts models to the marts dataset.
Warning: incorrect schema name generation can create unexpected datasets like tmp_tmp or tmp_marts.

All analytics datasets must live in the same location to avoid cross-location queries.

Migration note:
- BigQuery datasets cannot change location in place.
- If any existing datasets are in US, create a new EU analytics project or recreate datasets in EU and re-point PostHog and Stripe ingestion to EU.

## Core tables and partitioning

raw_posthog.events
- PostHog events model with JSON properties
- Columns: uuid, event, properties, elements, set, set_once, distinct_id, team_id, ip, site_url, timestamp, bq_ingested_timestamp
- IP values must be discarded at ingestion and the ip column should be NULL for new rows.
- Partition by DATE(timestamp)
- Cluster by event, distinct_id

raw_costs.costs_daily
- Partition by date
- Cluster by cost_type, tenant_id

raw_costs.ad_spend_daily
- Partition by date
- Cluster by platform, account_id

raw_costs.campaign_map
- Partition by valid_from
- Cluster by platform, account_id, campaign_id

Stripe tables live in `analytics/bigquery/stripe_bootstrap.sql`.

## PostHog BigQuery batch export setup

Events model only for now.

1. Create a service account in the Google Cloud project.
2. Grant BigQuery Job User at the project level.
3. Grant dataset level access to `raw_posthog` with a custom role or BigQuery Data Editor.
   - Minimum permissions: bigquery.datasets.get, bigquery.jobs.create, bigquery.tables.create, bigquery.tables.get, bigquery.tables.getData, bigquery.tables.list, bigquery.tables.updateData
   - For events model only, bigquery.tables.delete is not required.
4. In PostHog, create a BigQuery batch export with:
   - Dataset ID: raw_posthog
   - Table ID: events
   - Model: events
   - Properties fields as JSON where the option is available

## PostHog privacy settings

Enable IP discard in the PostHog UI:
- Settings - Project - Data management - Discard client IP data toggle.

Verification:
1. Capture a test event from a server-side endpoint.
2. In PostHog, open the event and confirm IP is not shown.
3. In BigQuery, confirm new rows in raw_posthog.events have ip IS NULL if the column exists.

## Schema evolution policy

PostHog can add new fields to the events model over time. New fields are not added automatically to the BigQuery table.

When PostHog adds fields:
1. Update the BigQuery table schema with ALTER TABLE ADD COLUMN for the new fields.
2. Keep properties, set, and set_once as JSON so new properties do not require schema changes.
3. Re-run exports after the schema update to backfill new fields if needed.

## Reconciliation thresholds

Daily reconciliation between Stripe purchases and purchase_success events is acceptable within 2 percent for counts and gross revenue. Use an absolute floor of 5 purchases and 50 EUR to avoid noise on low volume days. Larger drift should trigger investigation.

## Security and access

- Do not commit service account keys.
- Prefer GitHub Actions OIDC or a secret manager for production access.
- If a JSON key is required for local setup, store it outside the repo and reference it via environment variables or your local gcloud config.

## Smoke checks

Connectivity check for EU datasets:

```sql
SELECT *
FROM raw_posthog.events
ORDER BY timestamp DESC
LIMIT 10;
```

dbt scaffold check:

```bash
cd analytics/dbt
uv sync --frozen
uv run dbt deps
uv run dbt compile
```

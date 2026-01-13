# Analytics Warehouse

## Datasets and location

Use a single BigQuery location for all analytics datasets. Current standard location is US.

Datasets:
- raw_posthog
- raw_costs
- marts
- tmp

Bootstrap with `analytics/bigquery/warehouse_bootstrap.sql`. The script sets the dataset location to US for all datasets.

## Core tables and partitioning

raw_posthog.events
- PostHog events model with JSON properties
- Columns: uuid, event, properties, elements, set, set_once, distinct_id, team_id, ip, site_url, timestamp, bq_ingested_timestamp
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

## Schema evolution policy

PostHog can add new fields to the events model over time. New fields are not added automatically to the BigQuery table.

When PostHog adds fields:
1. Update the BigQuery table schema with ALTER TABLE ADD COLUMN for the new fields.
2. Keep properties, set, and set_once as JSON so new properties do not require schema changes.
3. Re-run exports after the schema update to backfill new fields if needed.

## Security and access

- Do not commit service account keys.
- Prefer GitHub Actions OIDC or a secret manager for production access.
- If a JSON key is required for local setup, store it outside the repo and reference it via environment variables or your local gcloud config.

## Smoke checks

Connectivity check:

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

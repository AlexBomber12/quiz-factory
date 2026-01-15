# Ad spend import

This document covers automated Meta ad spend import into BigQuery.

## Required env vars

- META_ACCESS_TOKEN
- META_AD_ACCOUNT_ID (use act_<id> or the raw numeric id)
- BQ_PROJECT_ID

## Local run

The importer defaults to the last 14 days to handle late attribution.

1. `cd analytics/dbt`
2. `uv sync --frozen`
3. `export META_ACCESS_TOKEN=...`
4. `export META_AD_ACCOUNT_ID=act_123456789`
5. `export BQ_PROJECT_ID=your-gcp-project`
6. `uv run python ../../scripts/importers/meta_ads_to_bq.py --dry-run`
7. `uv run python ../../scripts/importers/meta_ads_to_bq.py`

Optional overrides:

- `--since YYYY-MM-DD --until YYYY-MM-DD` to backfill a specific range.
- `--lookback-days 30` to change the default window when no explicit range is set.

## CI run

Workflow: `.github/workflows/meta-ad-spend-import.yml`

Required secrets:

- META_ACCESS_TOKEN
- META_AD_ACCOUNT_ID
- BQ_PROJECT_ID

GCP auth options:

- OIDC (preferred): set GCP_WORKLOAD_IDENTITY_PROVIDER and GCP_SERVICE_ACCOUNT.
- Service account key fallback: set GCP_SA_KEY to the JSON key.

The workflow runs the importer, then triggers dbt build.

## Troubleshooting

- No rows returned: confirm the account id is correct, the token has insights access, and the date range is valid.
- Currency mismatch: the importer stores spend as amount_eur, so the Meta account currency should be EUR.
- BigQuery errors: confirm raw_costs and tmp datasets exist and the service account has BigQuery Data Editor and Job User.
- CSV fallback: use `node apps/web/scripts/import-costs-csv.js --table ad_spend_daily --file <path>`.

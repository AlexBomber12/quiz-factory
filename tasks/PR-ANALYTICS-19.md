PR-ANALYTICS-19: Automated Ad Spend Import (Meta) + Operationalization

Read and follow AGENTS.md strictly.

Context
- CSV-first spend import exists and works.
- We want automated daily spend import for 1 channel.
- Choose Meta as the first channel.

Goal
- Import Meta ad spend daily into raw_costs.ad_spend_daily automatically.
- Preserve CSV import as a fallback.
- Ensure idempotency so repeated runs do not double count.

Workflow rules
- Create a new branch from main named: pr-analytics-19-meta-spend-import
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.

Task A: Importer implementation
A1) Add a Meta spend importer script
- Location: scripts/importers/meta_ads_to_bq.(ts|py)
- Fetch granularity: daily by campaign (campaign_id, campaign_name)
- Date range:
  - default to last 14 days to handle late attribution and corrections
- Map fields into raw_costs.ad_spend_daily:
  - date, platform=meta, account_id, campaign_id, campaign_name, amount_eur, impressions, clicks
  - utm_campaign optional (best-effort), campaign_map will handle mapping in marts
- Write using BigQuery MERGE so reruns are idempotent.

A2) Secrets and config
- Use env vars:
  - META_ACCESS_TOKEN
  - META_AD_ACCOUNT_ID
  - BQ_PROJECT_ID
- Do not print tokens in logs.

Task B: Scheduler
- Add a GitHub Actions workflow:
  - Runs daily (cron) and supports manual dispatch
  - Authenticates to GCP using OIDC if available, otherwise document service account key as a fallback
  - Runs importer and then triggers dbt build

Task C: Documentation
- Add docs/analytics/ad_spend_import.md:
  - required env vars
  - how to run locally
  - how to run in CI
  - troubleshooting

Task D: Tests and verification
- Add a dry-run mode that prints the number of rows that would be upserted.
- Add a small unit test for:
  - building the correct MERGE keys
  - date range selection

Success criteria
- Meta ad spend is imported automatically daily and does not double count on reruns.
- dbt marts reflect updated spend after the workflow run.
- CSV import remains available as a fallback.
- docs exist and are accurate.

# Analytics Cost Control

## Scope
- Metrics definitions follow `docs/metrics.md`.
- This guidance covers BigQuery cost observability and budget guardrails for EU analytics.

## BigQuery budgets and alerts
1) Open Google Cloud Console and go to Billing.
2) Select Budgets and alerts, then create a new budget for the BigQuery project.
3) Set the budget amount to the last 30 days spend plus a 20 percent buffer.
4) Add alert thresholds and notification channels.

Recommended alert thresholds
- 50 percent to catch early growth.
- 80 percent to signal elevated spend.
- 90 percent for high urgency.
- 100 percent to flag a budget breach.

## Cost observability tables
Run `analytics/bigquery/cost_observability/create_tables.sql` once to create the marts tables.

### mart_bq_cost_daily
This table summarizes BigQuery jobs by date using EU region job metadata.

Columns
- date: job creation date in UTC.
- total_bytes_processed: total bytes processed across jobs.
- total_bytes_billed: total bytes billed across jobs.
- total_slot_ms: total slot milliseconds across jobs.
- job_count: number of jobs.
- top_job_type: job type with the highest billed bytes for the day.
- top_job_type_bytes_billed: billed bytes for the top job type.

Interpretation
- total_bytes_billed is the primary cost driver.
- total_bytes_processed can be higher than billed due to caching and billing rules.
- total_slot_ms captures slot usage and helps spot heavy transformations.

## Query hygiene rules
- Always filter partitioned tables by the partition date column.
- Avoid full table scans in dashboards, especially over raw datasets.
- Limit lookback windows to the minimum required for reporting.
- Select only the columns needed for the analysis.

## Scheduled queries
Create BigQuery scheduled queries in the EU region. Use a service account with BigQuery Job User and dataset editor access on `marts`.

Daily mart_bq_cost_daily refresh
- Query: `analytics/bigquery/cost_observability/populate_cost_daily.sql`.
- Schedule: daily at 02:00 UTC.
- Notes: the script defaults to yesterday; set run_date to backfill.

Weekly mart_bq_cost_jobs_recent refresh
- Query: `analytics/bigquery/cost_observability/top_jobs_recent.sql`.
- Schedule: weekly on Monday at 03:00 UTC.
- Notes: replaces the recent jobs table with the latest 7 days of jobs.

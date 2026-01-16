# Analytics Alerts Runbook

## Purpose
Provide a repeatable process for creating and responding to BigQuery alert checks.

## Preconditions
- BigQuery access to the analytics project.
- `marts.alert_events` created via `analytics/bigquery/alerts/create_alerts_table.sql`.
- Scheduled queries run in the same project and location as the marts dataset.

## Scheduled queries to create
Run each SQL file as a scheduled query. Use standard SQL and write to the same project.

1) `analytics/bigquery/alerts/alert_freshness_raw_posthog.sql`
   - Cadence: every 15 minutes.
   - Purpose: detect stale PostHog ingestion.

2) `analytics/bigquery/alerts/alert_freshness_raw_stripe.sql`
   - Cadence: every 15 minutes.
   - Purpose: detect stale Stripe purchase ingestion.

3) `analytics/bigquery/alerts/alert_reconciliation_drift.sql`
   - Cadence: daily at 07:00 UTC.
   - Purpose: detect Stripe vs event drift for the prior day.

4) `analytics/bigquery/alerts/alert_conversion_drop.sql`
   - Cadence: daily at 08:00 UTC.
   - Purpose: detect purchase conversion drops for top tenants.

5) `analytics/bigquery/alerts/alert_refund_spike.sql`
   - Cadence: daily at 08:00 UTC.
   - Purpose: detect refund rate spikes.

6) `analytics/bigquery/alerts/alert_page_view_spike.sql`
   - Cadence: daily at 08:00 UTC.
   - Purpose: detect page view volume spikes.

## Routing alerts
- Manual first: review new rows in `marts.alert_events` each day.
- Store a saved BigQuery query or BI tile that filters to the last 3 days.
- Later: connect a scheduled query to Pub/Sub or Cloud Monitoring to post to Slack.

## Actions per alert type
### raw_posthog_freshness
- Check ingestion lag in `raw_posthog.events` using `MAX(bq_ingested_timestamp)`.
- Confirm PostHog export and ingestion jobs are running.
- Validate there is no backlog or quota error in the export pipeline.

### raw_stripe_freshness
- Check `raw_stripe.purchases` for the latest `created_utc`.
- Confirm Stripe webhook receiver logs and retry queue.
- Verify that webhook signing secrets and endpoints are valid.

### reconciliation_drift
- Run `docs/analytics/sql/reconciliation_daily.sql` for the failing date.
- Compare Stripe facts in `raw_stripe` to event facts in `raw_posthog`.
- Reprocess missing webhook events if a Stripe gap is confirmed.

### conversion_drop
- Inspect `marts.mart_funnel_daily` for the tenant and date.
- Check recent deploys or site changes that could block events.
- Validate that `page_view` and `purchase_success` are still emitted.

### refund_spike
- Review `raw_stripe.refunds` and `marts.mart_pnl_daily` for the tenant.
- Check support and payment provider logs for failures or fraud.
- Confirm that refund processing is not duplicated.

### page_view_spike
- Check for duplicate `page_view` events or sampling changes.
- Review `docs/analytics/event_volume.md` for sampling expectations.
- Confirm that session gating and high cardinality guards are still active.

## Tuning and ownership
- Thresholds live in the SQL templates. Update only after reviewing `docs/metrics.md`.
- Escalation owner follows `docs/analytics/alerts.md`.

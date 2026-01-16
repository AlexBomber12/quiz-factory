# Analytics Alerts

## Principles
- Metrics definitions follow `docs/metrics.md`.
- Prefer alert thresholds that avoid noise on low volume days.
- Use reporting timezone date fields from marts.

## What to alert on
1) No Stripe purchases ingested for 30 minutes
   - Source: raw_stripe.purchases.
   - Trigger: latest purchase created_utc older than 30 minutes.
   - Template: `analytics/bigquery/alerts/alert_freshness_raw_stripe.sql`
2) Purchase conversion drops by 30 percent day over day for a top tenant
   - Source: marts.mart_funnel_daily.
   - Trigger: purchase_conversion_rate < prior day * 0.70 for tenants in the
     top 5 by net_revenue_eur over the last 14 days.
   - Template: `analytics/bigquery/alerts/alert_conversion_drop.sql`
3) Refund rate exceeds 5 percent
   - Source: marts.mart_pnl_daily.
   - Trigger: safe_divide(refunds_eur, gross_revenue_eur) > 0.05.
   - Template: `analytics/bigquery/alerts/alert_refund_spike.sql`
4) Reconciliation drift exceeds threshold
   - Source: marts.mart_reconciliation_daily.
   - Trigger: purchase_count_diff_pct > 0.02 or gross_revenue_diff_pct > 0.02,
     with absolute drift over 5 purchases or 50 EUR.
   - Template: `analytics/bigquery/alerts/alert_reconciliation_drift.sql`
5) raw_posthog.events freshness fails
   - Source: raw_posthog.events.
   - Trigger: bq_ingested_timestamp older than the freshness threshold.
   - Template: `analytics/bigquery/alerts/alert_freshness_raw_posthog.sql`
6) Page view volume spikes
   - Source: marts.mart_funnel_daily.
   - Trigger: visits exceed a recent baseline by the configured multiplier.
   - Template: `analytics/bigquery/alerts/alert_page_view_spike.sql`

## Where alerts live
- PostHog alerts for funnel conversion and volume changes.
- BigQuery scheduled query alerts write to `marts.alert_events` using
  `analytics/bigquery/alerts/*.sql`.
- BI tool alerts for dashboard thresholds as a fallback.

## Ownership
- Primary owner: project owner.
- Escalation: project owner to engineering lead if not resolved in 24 hours.

## Runbook
- Follow `docs/ops/analytics_alerts_runbook.md` for setup and response steps.

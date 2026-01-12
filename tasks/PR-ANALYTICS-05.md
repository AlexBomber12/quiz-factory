PR-ANALYTICS-05: dbt Marts (P&L Daily, Funnel Daily, Unit Econ) + Data Quality (Revised)

Read and follow AGENTS.md strictly.

Context
- raw_posthog.events is exported to BigQuery.
- raw_stripe tables exist and are populated via PR-ANALYTICS-03.
- raw_costs tables exist via PR-ANALYTICS-04.
- We now build canonical marts in BigQuery using dbt.

Goal
- Produce marts tables that power dashboards and make unit economics explicit.
- Ensure models are cost-efficient (incremental) and trustworthy (tests + reconciliation).
- Use 2-level identity:
  - distinct_id for visitors (cohorts, repeat purchases)
  - session_id for attempts (funnel)

Workflow rules
- Create a new branch from main named: pr-analytics-05-dbt-marts
- Implement only what this task requests.
- Keep everything in English.
- Avoid using em dashes; use hyphens.
- Run dbt build and tests locally before committing.

Task A: dbt configuration
- Add a dbt variable reporting_timezone with default "UTC".
- All marts must derive date keys using reporting_timezone:
  - event_date = DATE(TIMESTAMP(timestamp), reporting_timezone)
  - purchase_date = DATE(TIMESTAMP(created_utc), reporting_timezone)

Task B: staging models (incremental where appropriate)
B1) stg_posthog_events
- Read from raw_posthog.events.
- Extract from properties JSON:
  - tenant_id, test_id, session_id, locale, device_type
  - utm_source, utm_medium, utm_campaign, utm_content, utm_term
  - fbclid, gclid, ttclid
- Use raw_posthog.events.distinct_id as distinct_id.
- Standardize event name field as event_name.
- Ensure timestamp_utc is present and typed.
- Implement as incremental on timestamp_utc.

B2) stg_stripe_purchases/refunds/disputes/fees
- Clean and type fields.
- Ensure amount_eur, fee_eur, net_eur are numeric.
- Ensure currency is eur and provider is stripe.

B3) stg_costs_daily, stg_ad_spend_daily, stg_campaign_map
- Type and clean.

Task C: marts
C1) marts.mart_funnel_daily
- Grain: date, tenant_id, test_id, locale, channel_key
- channel_key should be derived deterministically:
  - Prefer utm_source and utm_campaign if present, else classify as direct/organic/referral using referrer if available
- Metrics:
  - visits (page_view)
  - unique_visitors (count distinct distinct_id)
  - test_starts (test_start)
  - test_completes (test_complete)
  - paywall_views, checkout_starts
  - purchases (purchase_success)
  - conversion rates for each step
- Use session_id to connect attempt steps; do not require unique session_id across days.

C2) marts.mart_pnl_daily
- Grain: date, tenant_id, test_id, locale, channel_key
- Fields:
  - gross_revenue_eur (sum purchases.amount_eur)
  - refunds_eur (sum refunds.amount_eur)
  - disputes_eur (sum disputes.amount_eur)
  - payment_fees_eur (sum fees.fee_eur)
  - net_revenue_eur = gross - refunds - disputes - payment_fees
- Join purchases to events by purchase_id when available, otherwise by session_id metadata.

C3) marts.mart_unit_econ_daily
- Grain: date, tenant_id, test_id, locale, channel_key
- Fields:
  - aov_eur
  - profit_per_purchase_eur (placeholder until PR-07 adds spend and costs)
  - profit_per_visit_eur (placeholder until PR-07)

C4) marts.mart_reconciliation_daily
- Compare Stripe purchases vs purchase_success events:
  - count and gross amount by day
  - difference metrics
- This is used to detect broken tracking or broken webhook ingestion.

Task D: dbt tests and data quality
- not_null tests on:
  - date, tenant_id, locale, event_name where applicable
  - purchase_id on finance facts
- accepted_values for event_name set
- uniqueness tests:
  - mart_funnel_daily unique by (date, tenant_id, test_id, locale, channel_key)
  - mart_pnl_daily unique by (date, tenant_id, test_id, locale, channel_key)
- freshness test on raw_posthog.events (configured threshold)
- Add a reconciliation threshold note in docs (what is acceptable drift).

Success criteria
- dbt build produces staging and all marts tables successfully.
- dbt tests pass.
- mart_reconciliation_daily exists and shows low drift for a controlled test period.
- All marts use reporting_timezone consistently.
- Models are incremental and do not full-scan raw tables for every run.

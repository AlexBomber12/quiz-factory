PR-ANALYTICS-23: Unit Economics Truth (Credits, Offers, Effective ARP Report)

Read and follow AGENTS.md strictly.

Context
- Existing marts provide P&L daily, funnel daily, and a pricing breakdown from Stripe purchases.
- PR-PROD-02 standardizes offer_key/product_type/pricing_variant in Stripe metadata.
- PR-PROD-03 introduces credit grant and credit consumption behavior (without accounts) and emits analytics props.
- We need warehouse-level tables that explain profitability per consumed report, not just per purchase.

Goal
- Extend BigQuery raw and dbt marts so unit economics is explainable by offer and by credit consumption:
  - Purchases: capture offer metadata fields into raw_stripe.purchases (offer_key, product_type, pricing_variant, credits_granted).
  - Consumption: count credits_consumed from report_view events where consumed_credit=true.
  - Add effective metrics: effective_price_per_consumed_report and margin_per_consumed_report.

Scope
1) Raw Stripe schema alignment
- Locate the code that writes into raw_stripe.purchases (webhook handler SQL MERGE).
- Add nullable columns (if not present) for:
  - offer_key STRING
  - product_type STRING
  - pricing_variant STRING
  - credits_granted INT64
  - unit_price_eur NUMERIC
- Populate them from Stripe event/session metadata where available.
- Keep changes backward compatible (older rows can be NULL).

2) dbt staging
- In analytics/dbt/models/staging, add or extend staging models to expose the new columns from raw_stripe.purchases.
- In staging for PostHog events, extract:
  - consumed_credit (BOOLEAN)
  - credits_balance_after (INT64) if emitted
  - offer_key, product_type, pricing_variant if present on events
- Make sure all models remain incremental and partition-filtered.

3) dbt marts
- Update marts.mart_unit_econ_daily (or create marts.mart_unit_econ_offers_daily if clearer) to include:
  - purchases_single_count
  - purchases_pack_count
  - revenue_eur by offer_key and pricing_variant
  - credits_granted_total
  - credits_consumed_total
  - effective_price_per_consumed_report_eur = revenue_eur / NULLIF(credits_consumed_total, 0)
  - contribution_margin_per_consumed_report_eur = contribution_margin_eur / NULLIF(credits_consumed_total, 0)
- Add a reconciliation view/table that compares:
  - credits_granted_total (from Stripe purchases)
  - credits_consumed_total (from report_view)
  - and flags anomalies.

4) Data tests and guards
- Add dbt tests:
  - credits_consumed_total <= credits_granted_total within the same tenant and a configurable lookback window (for example 30 days), allowing small lag.
  - offer_key is not null for new purchases after a cutoff date (configurable).
- Keep the existing dataset/schema guardrails intact.

Constraints
- Do not increase query costs significantly. All new marts must be incremental and partition-filtered.
- Do not introduce PII or raw answers into warehouse models.

Workflow rules
- Create a new branch from main named: pr-analytics-23-unit-econ-credits
- Implement only what this task requests.
- Run the project test gate per AGENTS.md.

Definition of Done
- raw_stripe.purchases contains offer_key/product_type/pricing_variant/credits_granted for new purchases.
- dbt build produces updated marts with effective price per consumed report.
- A single query can answer, by day and tenant:
  - revenue_eur, fees_eur, refunds_eur, contribution_margin_eur
  - credits_granted_total, credits_consumed_total
  - effective_price_per_consumed_report_eur
- dbt tests pass and cost guardrails remain green.

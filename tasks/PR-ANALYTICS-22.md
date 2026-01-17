PR-ANALYTICS-22: Unit Economics Enhancements (Pricing Variants, Packs, Offer Breakdown)

Read and follow AGENTS.md strictly.

Context
- Current marts include mart_pnl_daily, mart_funnel_daily, and mart_unit_econ_daily.
- We need better unit economics visibility for:
  - intro pricing vs base pricing
  - single report vs pack purchases
  - effective price per report credit for packs
- Stripe metadata parsing already supports pricing_variant, but raw_stripe.purchases does not store it.

Goal
- Store pricing_variant in raw_stripe.purchases and stg_stripe_purchases.
- Add an offer breakdown mart and enrich mart_unit_econ_daily with pack and pricing metrics.
- Update docs/metrics.md with clear definitions.

Workflow rules
- Create a new branch from main named: pr-analytics-22-unit-econ-offers
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.
- Run the project test gate locally before committing.

Task A: Persist pricing_variant in Stripe purchase facts
A1) BigQuery DDL
- Update analytics/bigquery/stripe_bootstrap.sql:
  - Add pricing_variant STRING to raw_stripe.purchases schema.
- Add a migration helper SQL file:
  - analytics/bigquery/stripe_alter_pricing_variant.sql
  - It must contain:
    - ALTER TABLE raw_stripe.purchases ADD COLUMN IF NOT EXISTS pricing_variant STRING;

A2) Webhook ingestion
- Update apps/web/src/lib/stripe/store.ts:
  - Add pricing_variant: string | null to StripePurchaseRow.
- Update apps/web/src/lib/stripe/webhook.ts:
  - In buildPurchaseRowFromCheckoutSession, set pricing_variant from parsed metadata.
- Update apps/web/src/lib/stripe/webhook.test.ts:
  - Extend the mapping test to assert pricing_variant is written into the purchase row.

Task B: dbt staging
B1) Update analytics/dbt/models/staging/stripe/stg_stripe_purchases.sql
- Select pricing_variant from raw_stripe.purchases.

B2) Update analytics/dbt/models/staging/schema.yml
- Add pricing_variant to the stg_stripe_purchases model schema.

Task C: Offer normalization
C1) Add a dbt macro or a small staging CTE helper that normalizes product_type into:
- offer_type: one of single, pack_5, pack_10, unknown
- pack_size: 1, 5, 10, or null for unknown

Rules
- If product_type is null, treat as unknown.
- If product_type is not recognized, treat as unknown.

C2) Normalize pricing_variant
- Use lower(trim(pricing_variant)) where present.
- Default to 'unknown' when null.

Task D: Offer breakdown mart
D1) Add a new mart:
- analytics/dbt/models/marts/mart_offer_daily.sql

Grain
- date, tenant_id, test_id, locale, channel_key, offer_type, pricing_variant

Metrics
- purchases (count distinct purchase_id)
- gross_revenue_eur
- refunds_eur
- payment_fees_eur
- net_revenue_eur
- credits_sold (purchases * pack_size, where pack_size is null -> 0)
- effective_price_per_credit_eur = safe_divide(gross_revenue_eur, nullif(credits_sold, 0))

Implementation notes
- Reuse the same purchase attribution logic as mart_pnl_daily:
  - join Stripe purchases to PostHog purchase_success events by purchase_id and session_id
  - derive channel_key from utm_source, utm_campaign, and referrer
- Refunds, fees, and disputes must be attributed to the same offer_type and pricing_variant by joining on purchase_id.
- Make it incremental with the same incremental_date pattern used in other marts.

Task E: Enrich mart_unit_econ_daily
E1) Update analytics/dbt/models/marts/mart_unit_econ_daily.sql
- Keep existing columns unchanged.
- Add additional columns at the same grain:
  - purchases_single
  - purchases_pack_5
  - purchases_pack_10
  - pack_purchase_share = safe_divide(purchases_pack_5 + purchases_pack_10, purchases)
  - credits_sold_total
  - effective_price_per_credit_eur (aggregate across offers)
  - purchases_intro (pricing_variant == 'intro')
  - intro_purchase_share = safe_divide(purchases_intro, purchases)

Implementation approach
- Join aggregated mart_offer_daily (grouped back to the base grain) into the final select.

Task F: Metrics definitions
F1) Update docs/metrics.md
- Add definitions to Unit economics:
  - offer_type
  - pack_size
  - credits_sold
  - effective_price_per_credit_eur
  - pack_purchase_share
  - intro_purchase_share

Task G: Data quality
G1) Update analytics/dbt/models/marts/schema.yml
- Add schema entries and tests for the new marts and columns.
- Add a reconciliation test or query that ensures:
  - Summed gross_revenue_eur from mart_offer_daily matches mart_pnl_daily at the shared grain within 0.01 EUR.

Success criteria
- CI gate passes locally: CI=true scripts/ci.sh
- raw_stripe.purchases accepts pricing_variant and webhook ingestion writes it.
- dbt build succeeds and produces mart_offer_daily.
- mart_unit_econ_daily includes pack and pricing share columns.
- docs/metrics.md documents the new metrics.

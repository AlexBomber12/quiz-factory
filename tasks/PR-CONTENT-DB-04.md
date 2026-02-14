PR-CONTENT-DB-04: Stripe Facts Store (Content DB)

Branch name: pr/content-db-04-stripe-facts

Context
You are working in the Quiz Factory monorepo. This PR stores Stripe webhook-derived facts (purchases, refunds, disputes, fees) in Content DB so admin analytics can work without BigQuery. Implement only what is listed in this task. Do not ask follow-up questions.

Global constraints
- Do not commit secrets. Do not add or modify .env files.
- Keep changes minimal and scoped to this PR.
- Webhook handling must remain idempotent.
- BigQuery should be optional: missing BigQuery env must not crash the webhook route or builds.
- Content DB storage must be best-effort: do not fail the webhook solely because DB insert failed (log and continue).

Implementation tasks
1) Migration: Stripe facts tables in Postgres
- Add apps/web/src/lib/content_db/migrations/0005_stripe_facts.sql
- Create tables:
  - stripe_webhook_events_min (stripe_event_id PRIMARY KEY, type, created_utc, livemode, object_type, object_id, request_id, api_version, received_utc)
  - stripe_purchases (purchase_id PRIMARY KEY, provider, created_utc, amount_eur, currency, status, offer_key, product_type, pricing_variant, credits_granted, unit_price_eur, is_upsell, tenant_id, test_id, session_id, distinct_id, locale, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, gclid, ttclid, stripe_customer_id, stripe_payment_intent_id)
  - stripe_refunds (refund_id PRIMARY KEY, purchase_id, created_utc, amount_eur, status)
  - stripe_disputes (dispute_id PRIMARY KEY, purchase_id, created_utc, amount_eur, status)
  - stripe_fees (balance_transaction_id PRIMARY KEY, purchase_id, created_utc, fee_eur, net_eur)
- Add helpful indexes:
  - purchases by (created_utc), (tenant_id, created_utc), (test_id, created_utc)
  - refunds/disputes by (created_utc)
  - fees by (created_utc)

2) Storage implementation
- Add apps/web/src/lib/stripe/content_db.ts:
  - ContentDbStripeAnalyticsStore implements StripeAnalyticsStore using getContentDbPool().
  - Use INSERT ... ON CONFLICT DO NOTHING for idempotency.
  - Provide createStripeContentDbStore(): ContentDbStripeAnalyticsStore | null (returns null if CONTENT_DATABASE_URL is missing).

3) Webhook route wiring
- Update apps/web/src/app/api/stripe/webhook/route.ts:
  - Do not hard-fail at module import time when BigQuery env is missing.
  - Keep STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET required, but validate them inside POST and return 500 JSON with a clear message when missing.
  - Build a “multi-store” writer:
    - If BigQuery env is configured, include BigQuery store.
    - If CONTENT_DATABASE_URL is configured, include Content DB store.
    - If both available, write to both. If one fails, log and continue the other.
  - Preserve existing capturePosthogEvent behavior.

4) Tests
- Unit tests for:
  - createStripeContentDbStore() returns null when CONTENT_DATABASE_URL missing.
  - multi-store selection logic (BigQuery env present vs absent).
  - do not require live BigQuery credentials in tests.

Manual verification checklist (include in PR description)
- With Stripe test mode and webhook secret configured:
  - trigger a webhook (Stripe CLI or test payment)
  - verify rows appear in stripe_webhook_events_min and stripe_purchases in Postgres.

Local verification (run and report in PR description)
- pnpm --filter @quiz-factory/web lint
- pnpm --filter @quiz-factory/web typecheck
- pnpm --filter @quiz-factory/web test
- pnpm --filter @quiz-factory/web build
- ./scripts/smoke.sh http://localhost:3000

Commit message
PR-CONTENT-DB-04: Stripe Facts Store (Content DB)

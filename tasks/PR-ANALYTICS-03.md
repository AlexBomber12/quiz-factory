PR-ANALYTICS-03: Stripe Webhooks to raw_stripe and Purchase Events

Goal
- Make money metrics truthful: ingest Stripe webhooks, store raw + normalized facts, and emit purchase_success linked to session_id.

Changes
- Add Stripe webhook endpoint (verify signature).
- Store raw webhook events in BigQuery table raw_stripe.webhook_events with idempotency by Stripe event id.
- Normalize into BigQuery:
  - raw_stripe.purchases (payment_intent or checkout_session id, amount, currency, created_at, tenant_id, test_id, session_id, utm_*)
  - raw_stripe.refunds (refund id, purchase id, amount, created_at)
  - raw_stripe.disputes (dispute id, purchase id, amount, status, created_at)
  - raw_stripe.fees (purchase id, balance_transaction id, fee amount, net amount)
- Link Stripe payment to analytics session:
  - When creating Stripe Checkout, attach metadata: tenant_id, test_id, session_id, locale, utm_*
  - Webhook uses this metadata to write tenant_id/test_id/session_id into BigQuery
- Emit PostHog server-side event purchase_success on webhook success:
  - Must include tenant_id, test_id, session_id, locale, amount_eur, product_type (single or pack)

Tests
- Stripe CLI local test: verify signature handling and idempotency.
- Unit tests for webhook event parsing and BigQuery insert payload building.

Success criteria
- BigQuery tables raw_stripe.webhook_events, purchases, refunds, disputes, fees exist and get populated.
- purchase_success is emitted server-side and contains the same session_id as checkout_start.
- Fees are recorded (via balance_transaction lookup or equivalent).

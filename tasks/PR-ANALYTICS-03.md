PR-ANALYTICS-03: Stripe Webhooks, Finance Facts, and Tracking Alignment

Read and follow AGENTS.md strictly.

Context
- PR-ANALYTICS-01 and PR-FIX-ANALYTICS-01 are merged.
- PR-ANALYTICS-02 is merged and provides server-side PostHog tracking with session_id.
- New improvements were identified. Any required fixes to PR-01 or PR-02 must be included in this PR.

Goal
- Make money metrics truthful and privacy-safe:
  - Ingest Stripe webhooks.
  - Store raw-minimized webhook facts (no PII).
  - Build normalized finance tables (purchases, refunds, disputes, fees) in BigQuery.
  - Emit backend-only finance events to PostHog.
- Align tracking identifiers for reliable unit economics:
  - distinct_id = anonymous visitor id
  - session_id = test attempt id (attempt_id)
  - Ensure Stripe metadata includes tenant_id, test_id, session_id, distinct_id, locale, utm_*.

Workflow rules
- Create a new branch from main named: pr-analytics-03-stripe-finance-facts
- Implement only what this task requests.
- Do not commit secrets. Do not store Stripe raw payloads with PII.
- Keep everything in English.
- Avoid using em dashes; use hyphens.
- Run the project test gate locally before committing.

Task A: Tracking alignment updates (fixups to PR-01 and PR-02)
A1) Update docs/metrics.md (do not rewrite the whole doc)
- Clarify identifier semantics:
  - distinct_id is the canonical anonymous visitor id (visitor_id)
  - session_id is the canonical attempt id (attempt_id)
- Add an explicit rule for reporting timezone:
  - Raw timestamps must be stored in UTC
  - Daily marts use a single configurable reporting timezone (default UTC)
- Add a short privacy note:
  - Stripe raw payloads may contain PII and must not be stored in analytics raw tables
  - Only minimal Stripe facts and our own metadata keys are allowed

A2) Update analytics/events.json contract
- Ensure all events have a distinct_id field available for analysis.
  - If you do not want to make it globally required, make it globally optional but add a global.note that it must be sent by the app in production.
- Add optional click id fields:
  - fbclid, gclid, ttclid (nullable, omit when not present)
- Ensure finance events include:
  - purchase_success: purchase_id, amount_eur, product_type (single|pack5|pack10), payment_provider (stripe), is_upsell (boolean)
  - refund_issued: purchase_id, refund_id, amount_eur, payment_provider
  - dispute_opened: purchase_id, dispute_id, amount_eur, payment_provider
- Ensure no forbidden PII fields are allowed.

A3) Update server-side PostHog tracking module (from PR-ANALYTICS-02)
- Ensure every server-side event is captured with PostHog distinct_id:
  - distinct_id must be stable per browser via cookie.
  - session_id remains per attempt and is included as an event property and in the contract field session_id.
- Tenant resolution must consider reverse proxy headers:
  - Use X-Forwarded-Host if present, otherwise Host.
- Add best-effort asynchronous sending with retry:
  - Tracking must never block the user-facing request path.
  - If PostHog is down, requests still succeed.

Task B: Minimal BigQuery bootstrap required for Stripe ingestion
Note
- PR-ANALYTICS-04 will bootstrap the rest of BigQuery and dbt.
- This PR must create only what is required so Stripe webhooks can write facts immediately.

Create dataset if missing:
- raw_stripe
- tmp

Create BigQuery tables (partition by date, cluster by id where useful):
- raw_stripe.webhook_events_min
  - Stores safe fields only. Must not store full webhook payload.
  - Columns (minimum):
    - stripe_event_id (string)
    - type (string)
    - created_utc (timestamp)
    - livemode (bool)
    - object_type (string)
    - object_id (string)
    - request_id (string, nullable)
    - api_version (string, nullable)
    - received_utc (timestamp)
- raw_stripe.purchases
  - purchase_id (string)
  - provider (string, default stripe)
  - created_utc (timestamp)
  - amount_eur (numeric)
  - currency (string, must be eur)
  - status (string)
  - product_type (string)
  - is_upsell (bool)
  - tenant_id (string)
  - test_id (string, nullable)
  - session_id (string, nullable)
  - distinct_id (string, nullable)
  - locale (string)
  - utm_source/utm_medium/utm_campaign/utm_content/utm_term (nullable)
  - click ids (fbclid/gclid/ttclid, nullable)
  - stripe_customer_id (string, nullable)
  - stripe_payment_intent_id or checkout_session_id (string, nullable)
- raw_stripe.refunds
  - refund_id (string)
  - purchase_id (string)
  - created_utc (timestamp)
  - amount_eur (numeric)
  - status (string)
- raw_stripe.disputes
  - dispute_id (string)
  - purchase_id (string)
  - created_utc (timestamp)
  - amount_eur (numeric)
  - status (string)
- raw_stripe.fees
  - purchase_id (string)
  - balance_transaction_id (string)
  - created_utc (timestamp)
  - fee_eur (numeric)
  - net_eur (numeric)

Task C: Stripe webhooks ingestion (privacy-safe)
C1) Add Stripe webhook endpoint (verify signature)
- Process only required event types for the analytics system:
  - checkout.session.completed or payment_intent.succeeded (pick the canonical one your product uses)
  - charge.refunded or refund-related events
  - charge.dispute.created (and updates if needed)
- Ensure idempotency:
  - webhook_events_min deduped by stripe_event_id
  - purchases deduped by purchase_id
  - refunds deduped by refund_id
  - disputes deduped by dispute_id

C2) Do not store full Stripe payload
- Never write the full event JSON to BigQuery.
- Only write webhook_events_min and normalized tables.
- If you need debugging, store stripe_event_id and object_id and rely on Stripe dashboard logs.

C3) Link Stripe payments back to analytics identifiers
- When creating Stripe Checkout (or PaymentIntent), attach metadata:
  - tenant_id, test_id, session_id, distinct_id, locale
  - utm_* and click ids if present
  - product_type, is_upsell, pricing_variant (if you have it)
- Webhook parser must read metadata and store it in raw_stripe.purchases.

C4) Record fees using balance_transaction
- For each purchase, resolve Stripe balance_transaction and store fee_eur and net_eur in raw_stripe.fees.

Task D: Emit backend-only finance events to PostHog
- Emit purchase_success only after webhook confirmation.
- Emit refund_issued and dispute_opened from webhook processing.
- Ensure these events include tenant_id, locale, session_id, distinct_id when available, device_type, and all required finance fields from analytics/events.json.

Tests
- Add unit tests for:
  - webhook signature verification flow (mocked)
  - idempotency behavior for repeated Stripe events
  - mapping metadata into raw_stripe.purchases
- Add an integration test or script that replays a sample webhook payload and asserts that:
  - webhook_events_min has 1 row
  - purchases has 1 row
  - fees has 1 row
  - purchase_success event is emitted with the same session_id as checkout_start

Success criteria
- Stripe webhook ingestion is idempotent and privacy-safe (no raw payload stored).
- raw_stripe tables exist and are populated for purchases, refunds, disputes, and fees.
- purchase_success is emitted server-side and can be joined to checkout_start by session_id.
- docs/metrics.md and analytics/events.json reflect distinct_id vs session_id semantics and reporting timezone rule.
- All tests pass locally.

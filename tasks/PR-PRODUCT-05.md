PR-PRODUCT-05: Paywall UI and Stripe Checkout Session Creation

Read and follow AGENTS.md strictly.

Context
- We have a working flow up to result preview and a signed RESULT_COOKIE.
- We already have analytics endpoints:
  - POST /api/paywall/view
  - POST /api/checkout/start (requires attempt_token and returns stripe_metadata)
- Stripe webhook ingestion is already implemented and writes purchases, fees, refunds, and disputes to BigQuery.
- We need a real payment flow for single and pack purchases.

Goal
- Add a paywall page with pricing options.
- Create Stripe Checkout Sessions server-side and redirect users to Stripe.
- Ensure paywall_view and checkout_start analytics are emitted.
- Keep everything simple (no accounts).

Workflow rules
- Create a new branch from main named: pr-product-05-paywall-stripe
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.
- Run the project test gate locally before committing.

Task A: Paywall page
A1) Add a new route:
- apps/web/src/app/t/[slug]/pay/page.tsx

Behavior
- Resolve tenant_id and locale.
- Read RESULT_COOKIE on the server. If missing or invalid, show an error and link back to /t/[slug]/run.
- Render a paywall with 3 purchase options:
  - Single report: EUR 1.49 (pricing_variant: intro)
  - Pack 5 reports: EUR 4.99 (product_type: pack_5)
  - Pack 10 reports: EUR 7.99 (product_type: pack_10)

A2) Emit paywall_view
- On paywall page load (client side), POST /api/paywall/view with:
  - test_id
  - session_id (optional, cookie fallback is OK)

A3) Purchase button behavior
- When the user clicks an option, the client must:
  1) Generate a purchase_id (uuid v4).
  2) POST /api/checkout/start with:
     - test_id
     - product_type
     - pricing_variant
     - is_upsell: false
     - purchase_id
     It returns stripe_metadata.
  3) POST /api/checkout/create with:
     - purchase_id
     - product_type
     - pricing_variant
     - stripe_metadata
  4) Redirect the browser to checkout_url returned from /api/checkout/create.

Notes
- Do not store purchase_id in local storage.
- Do not log request bodies.

Task B: Stripe checkout creation endpoint
B1) Add a new API route:
- apps/web/src/app/api/checkout/create/route.ts

Request
- Method: POST
- Enforce the same request guards as other public routes (method, host, origin, rate limit, max body bytes).
- Body fields:
  - purchase_id
  - product_type (single, pack_5, pack_10)
  - pricing_variant (intro, base)
  - stripe_metadata (object)

Behavior
- Require STRIPE_SECRET_KEY to be present; otherwise return 503.
- Create a Stripe Checkout Session:
  - mode: payment
  - currency: eur
  - amount based on product_type
  - metadata: stripe_metadata
  - client_reference_id: purchase_id
  - success_url: https://<host>/checkout/success?session_id={CHECKOUT_SESSION_ID}
  - cancel_url: https://<host>/t/<slug>/pay
- Return JSON:
  - checkout_url
  - stripe_session_id

B2) Safety
- Reject unknown product_type or pricing_variant.
- Ensure stripe_metadata is a plain object with only string values.
- Do not include any PII fields.

Task C: Update preview CTA
C1) Update /t/[slug]/preview page
- Replace the placeholder CTA with a link to /t/[slug]/pay.

Task D: Documentation
D1) Add docs/ops/stripe_checkout.md
- Required env vars and what they do:
  - STRIPE_SECRET_KEY
  - STRIPE_WEBHOOK_SECRET
- Local testing guidance using Stripe test mode.
- Note that all revenue recognition is from webhook facts.

Task E: Tests
E1) Add unit tests for /api/checkout/create
- Mock Stripe client.
- Assert:
  - correct amount and currency for each product_type
  - metadata passed through
  - success_url and cancel_url are derived from host

Success criteria
- scripts/ci.sh passes.
- A user can reach the paywall and start Stripe checkout for single and packs.
- checkout_start is emitted via /api/checkout/start.
- Stripe webhook continues to record purchases in raw_stripe.purchases.

PR-PRODUCT-06: Checkout Success, Entitlement Token, and Paid Report (HTML)

Read and follow AGENTS.md strictly.

Context
- PR-PRODUCT-05 redirects users to Stripe Checkout.
- Stripe webhook ingestion records purchases, but we need a user-facing paid report page.
- There are no user accounts, so entitlements must be per purchase.
- We already have a signed RESULT_COOKIE with derived scores.

Goal
- Verify Stripe Checkout success server-side.
- Issue a signed report entitlement token (httpOnly) to avoid repeated Stripe API calls.
- Render a paid HTML report page using content and derived scores.
- Emit report_view analytics with purchase_id.

Workflow rules
- Create a new branch from main named: pr-product-06-paid-report
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.
- Run the project test gate locally before committing.

Task A: Report token
A1) Add a report token module:
- apps/web/src/lib/product/report_token.ts

Requirements
- Cookie name: REPORT_TOKEN
- Payload (signed JSON):
  - purchase_id
  - tenant_id
  - test_id
  - session_id
  - distinct_id
  - product_type
  - pricing_variant
  - issued_at_utc
  - expires_at_utc
- Use HMAC SHA-256 signing.
- Secret source: env var REPORT_TOKEN_SECRET (required in production).
- Provide:
  - signReportToken(payload): string
  - verifyReportToken(value): payload | null

Task B: Stripe checkout confirmation endpoint
B1) Add an API route:
- apps/web/src/app/api/checkout/confirm/route.ts

Request
- Method: POST
- Enforce the same request guards as other public routes.
- Body fields:
  - stripe_session_id

Behavior
- Require STRIPE_SECRET_KEY.
- Retrieve the Stripe Checkout Session via Stripe API.
- Verify it is paid:
  - payment_status == "paid" (or equivalent paid status)
- Extract metadata:
  - purchase_id, tenant_id, test_id, session_id, distinct_id, locale, product_type, pricing_variant
- Issue REPORT_TOKEN cookie with a reasonable TTL (for example 24 hours).
- Return JSON:
  - ok: true
  - purchase_id
  - test_id

Safety
- Do not store any PII from Stripe.
- Do not return Stripe customer data.

Task C: Checkout success page
C1) Add a route:
- apps/web/src/app/checkout/success/page.tsx

Behavior
- Client component.
- Read stripe_session_id from query param session_id.
- POST /api/checkout/confirm.
- On success, redirect to /report/<slug> (resolve slug from test_id).
- On failure, render an error and link back to /.

Task D: Paid report page
D1) Add a new route:
- apps/web/src/app/report/[slug]/page.tsx

Behavior
- Server component.
- Verify REPORT_TOKEN cookie.
- Verify RESULT_COOKIE cookie.
- Ensure both tokens match the same tenant_id and test_id.
- Load localized content and render a full report view:
  - report_title
  - band headline, summary, bullets
  - optionally show scale_scores and total score
- If token missing or invalid, show a blocked state with a link to /t/[slug].

D2) Emit report_view analytics
- On report page load (client side), POST /api/report/view with:
  - test_id
  - purchase_id

Task E: Documentation
E1) Add docs/ops/report_tokens.md
- Explain RESULT_COOKIE vs REPORT_TOKEN.
- Explain TTLs and required env vars:
  - RESULT_COOKIE_SECRET
  - REPORT_TOKEN_SECRET

Task F: Tests
F1) Unit tests:
- report token signing and verification
- checkout confirm handler validation (mock Stripe)

Success criteria
- scripts/ci.sh passes.
- After a successful Stripe checkout, /checkout/success leads to a paid report page.
- Report page is blocked without REPORT_TOKEN.
- report_view is emitted with purchase_id.

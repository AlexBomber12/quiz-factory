PR-ANALYTICS-11: Implement analytics/events.json (Full Coverage) + Contract Enforcement

Read and follow AGENTS.md strictly.

Context
- analytics/events.json is the contract for event names and required properties.
- The code currently implements only a subset of event names.

Goal
- Ensure every event defined in analytics/events.json has a corresponding server-side emission path:
  - API route using handleAnalyticsEvent, or
  - backend webhook emission (Stripe events).
- Add a contract test that fails when analytics/events.json and code event names diverge.

Workflow rules
- Create a new branch from main named: pr-analytics-11-events-contract
- Implement only what this task requests.
- Keep everything in English.
- Avoid using em dashes; use hyphens.

Task A: Event name parity
- Update apps/web/src/lib/analytics/events.ts AnalyticsEventName to include:
  - purchase_failed
  - upsell_view
  - upsell_accept
  - share_click
- Ensure AnalyticsEventProperties contains required fields for those events:
  - purchase_failed: purchase_id, failure_reason
  - upsell_*: purchase_id, upsell_id (accept requires upsell_id)
  - share_click: share_target

Task B: Missing API routes
B1) Add apps/web/src/app/api/share/click/route.ts
- Emits share_click
- Input:
  - session_id, test_id, share_target
  - distinct_id optional (cookie fallback)

B2) Add apps/web/src/app/api/upsell/view/route.ts
- Emits upsell_view
- Input:
  - session_id, test_id, purchase_id
  - upsell_id optional

B3) Add apps/web/src/app/api/upsell/accept/route.ts
- Emits upsell_accept
- Input:
  - session_id, test_id, purchase_id, upsell_id (required)

Task C: purchase_failed from Stripe
C1) Extend Stripe webhook handling to emit purchase_failed
- Handle at least 1 failure webhook type relevant to your flow:
  - checkout.session.async_payment_failed
  - payment_intent.payment_failed
  - checkout.session.expired
- For each failure:
  - Identify purchase_id (checkout session id or payment intent id)
  - Emit purchase_failed with:
    - purchase_id
    - failure_reason set to the webhook type or mapped reason
    - tenant_id, session_id, distinct_id, test_id from metadata when available
- Ensure idempotency for failure events, similar to purchase_success.

Task D: Contract enforcement test
- Add a unit test that:
  1) Reads analytics/events.json and collects its top-level keys (event names).
  2) Compares them to the AnalyticsEventName union list (or an exported array).
  3) Fails if any names are missing in either direction.
- The test must run in CI as part of the normal test suite.

Success criteria
- All event names in analytics/events.json exist in code and have an emission path.
- purchase_failed is emitted from Stripe webhook failure events.
- share_click and upsell routes emit events with correct required fields.
- The contract enforcement test prevents drift between events.json and code.
- Tests pass locally.

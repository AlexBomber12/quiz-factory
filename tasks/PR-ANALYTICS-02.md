PR-ANALYTICS-02: Server-side Tracking and session_id

Goal
- Implement server-side PostHog tracking with a consistent session_id and tenant_id across the full funnel.

Changes
- Add a server-side analytics module (for example: src/lib/analytics) that sends events to PostHog using the server key.
- Implement tenant resolution:
  - Resolve tenant_id from the request Host header (domain)
  - Expose tenant_id to tracking and business logic
- Implement session_id:
  - session_id is generated server-side at test start and persisted for subsequent steps
  - session_id is returned to the client (response JSON) and re-sent on subsequent API calls
  - session_id is also stored in a cookie as fallback
- Persist UTM:
  - Capture utm_* from the first request and attach it to session state
  - Ensure utm_* is available in server-side tracking and later joins with Stripe
- Emit server-side events for:
  - test_start (when server creates session_id)
  - test_complete (when server receives completion)
  - result_preview_view (when server renders/serves preview)
  - paywall_view (when paywall is shown)
  - checkout_start (when Stripe checkout is created)
  - report_view and report_pdf_download (when served)

Non-goals
- No client-side tracking required in this PR. Keep it server-first.

Tests
- Add unit tests for:
  - tenant_id resolution from Host
  - session_id creation and propagation
  - utm_* persistence
- Add a minimal integration test that simulates: start -> complete -> paywall -> checkout_start and verifies the same session_id is tracked in all emitted events.

Success criteria
- All tracked events contain tenant_id, session_id, locale, and utm_* when present.
- session_id is stable across the funnel for a single attempt.
- No raw answers or PII is sent to PostHog.

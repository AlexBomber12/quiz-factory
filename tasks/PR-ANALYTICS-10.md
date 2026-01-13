PR-ANALYTICS-10: Implement page_view

Read and follow AGENTS.md strictly.

Context
- mart_funnel_daily computes visits and unique_visitors from page_view events.
- page_view exists in analytics/events.json but is not emitted by the application.

Goal
- Emit page_view events in the server-side tracking flow so visits and unique_visitors become meaningful.
- Keep session_id semantics:
  - session_id remains the attempt_id created by test_start.
  - page_view is emitted for pages within the attempt flow where session_id exists.

Workflow rules
- Create a new branch from main named: pr-analytics-10-page-view
- Implement only what this task requests.
- Keep everything in English.
- Avoid using em dashes; use hyphens.

Task A: Add page_view event name support
- Update apps/web/src/lib/analytics/events.ts:
  - Add "page_view" to AnalyticsEventName.
  - Ensure AnalyticsEventProperties supports the optional page_view fields:
    - page_url (string nullable)
    - page_type (string nullable)

Task B: Add a page view API route
B1) Add apps/web/src/app/api/page/view/route.ts
- Must accept:
  - session_id (required)
  - distinct_id (required, or from cookie)
  - test_id (optional)
  - page_type (optional)
- Must capture page_view using the same base properties:
  - tenant_id and locale resolved server-side
  - utm and click ids captured from query and cookies
  - referrer, device_type, country, language best-effort
- Must set cookies for distinct_id and session_id if needed.

B2) Update the existing funnel test
- Update apps/web/src/app/api/analytics-flow.test.ts:
  - Call the new page view endpoint once after test_start and before test_complete.
  - Assert that page_view is emitted and shares the same session_id.

Task C: Ensure marts become non-zero
- Update docs/metrics.md if needed:
  - Clarify that visits are based on page_view for attempt pages.

Success criteria
- page_view events are captured server-side and include tenant_id, session_id, distinct_id.
- analytics-flow.test includes page_view and still passes.
- When data flows to BigQuery, mart_funnel_daily visits and unique_visitors become non-zero.

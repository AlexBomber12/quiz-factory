PR-PRODUCT-03: Test Runner UI and Attempt Entry page_view

Read and follow AGENTS.md strictly.

Context
- The repo already has analytics API routes:
  - POST /api/test/start issues session_id and attempt_token
  - POST /api/page/view requires attempt_token
  - POST /api/test/complete requires attempt_token
- PR-PRODUCT-02 added /t/[slug] landing pages.
- We need a working mobile test runner UI for a single test.
- We must not send raw answers to analytics.

Goal
- Implement a minimal test runner UI for single_choice questions.
- Ensure analytics events are emitted:
  - test_start
  - page_view with page_type=attempt_entry
  - test_complete
- Keep the implementation simple and avoid premature features (no accounts, no saving answers).

Workflow rules
- Create a new branch from main named: pr-product-03-test-runner
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.
- Run the project test gate locally before committing.

Task A: Test runner route
A1) Add a new route:
- apps/web/src/app/t/[slug]/run/page.tsx

Behavior
- Resolve tenant_id and locale.
- Resolve slug to test_id.
- Load localized test content and render a start screen with a single primary button.

On start button click
- POST /api/test/start with JSON body:
  - test_id
- Store session_id and attempt_token from the JSON response in React state.

Immediately after successful test_start
- POST /api/page/view with JSON body:
  - test_id
  - session_id
  - attempt_token
  - page_type: "attempt_entry"
  - page_url: window.location.pathname
- Ignore errors from page_view (best effort).

Runner UI
- Render one question at a time.
- Single choice only:
  - show option buttons or radio list
  - require a selection before enabling Next
- Provide Back and Next controls.
- Provide a simple progress indicator (current / total).
- Keep answers only in client state. Do not send answers to analytics endpoints.

On finish
- POST /api/test/complete with JSON body:
  - test_id
  - session_id
  - attempt_token
- On success, navigate to /t/[slug]/preview.

Task B: Preview placeholder
B1) Add a placeholder route:
- apps/web/src/app/t/[slug]/preview/page.tsx

Behavior
- Resolve tenant_id and locale.
- Render a placeholder preview screen with a note that scoring will be implemented in PR-PRODUCT-04.
- Include a button that navigates back to /t/[slug].

Task C: Client API helpers
C1) Add a small client helper module:
- apps/web/src/lib/product/client.ts

It must provide:
- startAttempt(testId): Promise<{ session_id: string; attempt_token: string }>
- emitAttemptEntryPageView(params): Promise<void>
- completeAttempt(params): Promise<void>

Rules
- All requests must be POST with application/json.
- Do not log request bodies.

Task D: Unit tests
D1) Add vitest tests for the client helpers.
- Mock global fetch and assert:
  - correct URL and method
  - correct JSON body keys
  - startAttempt rejects if attempt_token missing

Success criteria
- scripts/ci.sh passes.
- A user can navigate: / -> /t/[slug] -> /t/[slug]/run and complete the golden test.
- Network calls show test_start, page_view (attempt_entry), and test_complete.
- No raw answers are sent to analytics.

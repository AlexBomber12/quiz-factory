PR-PRODUCT-04: Server-side Scoring, Result Preview, and Result Cookie

Read and follow AGENTS.md strictly.

Context
- PR-PRODUCT-03 implemented a test runner that tracks test_start, attempt_entry page_view, and test_complete.
- The app must not store raw answers in analytics or databases.
- We need a real preview result screen that is derived from answers, and we need a safe way to carry derived scores into the paid report flow later.

Goal
- Add a server endpoint that computes preview results from answers without persisting those answers.
- Store only derived results in a signed httpOnly cookie.
- Replace the preview placeholder page with a real preview view and emit result_preview_view analytics.

Workflow rules
- Create a new branch from main named: pr-product-04-server-scoring
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.
- Run the project test gate locally before committing.

Task A: Result cookie
A1) Add a new result cookie module:
- apps/web/src/lib/product/result_cookie.ts

Requirements
- Cookie name: RESULT_COOKIE
- Cookie value: a signed JSON payload with:
  - tenant_id
  - session_id
  - distinct_id
  - test_id
  - computed_at_utc
  - band_id
  - scale_scores (object)
- Use HMAC SHA-256 signing.
- Secret source: env var RESULT_COOKIE_SECRET (required in production).
- Provide functions:
  - signResultCookie(payload): string
  - verifyResultCookie(value): payload | null

Task B: Scoring engine
B1) Add a scoring module:
- apps/web/src/lib/product/scoring.ts

Requirements
- Input: validated test spec and an answers map of question_id to option_id.
- Output:
  - scale_scores (sum of option_weights)
  - total_score (sum over all scales)
  - band_id resolved by matching total_score into result_bands inclusive ranges
- Validation
  - Reject if an answer references unknown question_id or option_id.
  - Reject if any required question is missing.

Task C: Score preview API endpoint
C1) Add a new API route:
- apps/web/src/app/api/test/score-preview/route.ts

Request
- Method: POST
- Enforce the same request guards as other public routes:
  - allowed method
  - allowed host and origin
  - rate limit
  - max body bytes
- Body fields:
  - test_id
  - session_id
  - attempt_token
  - answers (object question_id -> option_id)

Behavior
- Verify attempt_token matches tenant_id, session_id, distinct_id.
- Load and validate the test spec.
- Compute scoring and band_id.
- Set RESULT_COOKIE as httpOnly, sameSite=lax, secure in production.
- Return JSON preview with:
  - test_id
  - band_id
  - scale_scores

Logging rules
- Do not log request bodies.
- Do not persist answers.

Task D: Wire scoring into runner and preview UI
D1) Update the runner flow in /t/[slug]/run
- On finish, after test_complete succeeds:
  - call /api/test/score-preview with answers and attempt_token
  - then navigate to /t/[slug]/preview

D2) Replace the preview placeholder page
- apps/web/src/app/t/[slug]/preview/page.tsx

Behavior
- Read RESULT_COOKIE on the server.
- If missing or invalid, show an error and link back to /t/[slug]/run.
- Load localized test content and render the preview copy for band_id.
- Add a primary CTA button to continue to paywall (to be implemented in PR-PRODUCT-05).

D3) Emit analytics event result_preview_view
- On preview page load, call POST /api/result/preview with:
  - test_id
  - session_id (from cookie or state)
  - attempt_token (if available)

Task E: Tests
E1) Add unit tests for:
- scoring engine (happy path and missing answer)
- result cookie signing and verification

Success criteria
- scripts/ci.sh passes.
- Preview page shows a deterministic result band for the golden test.
- No raw answers are stored in PostHog or BigQuery.
- RESULT_COOKIE contains only derived data and is signed.

PR-SECURITY-02: Attempt Token and Replay Protection

Read and follow AGENTS.md strictly.

Context
- session_id is the attempt identifier.
- distinct_id is the visitor identifier.
- We want to prevent replay and forged calls to event endpoints using random session_id values.

Goal
- Introduce a signed attempt_token bound to:
  - tenant_id
  - session_id
  - distinct_id
  - expiry (TTL)
- Require attempt_token for all attempt-scoped event routes.
- Add event_id-based deduplication for event routes to prevent replays.

Workflow rules
- Create a new branch from main named: pr-security-02-attempt-token
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.
- Run the project test gate locally before committing.

Task A: Implement attempt_token
A1) Add a module, for example:
- apps/web/src/lib/security/attempt_token.ts

Requirements:
- Token format: base64url(payload).base64url(signature)
- Signature: HMAC-SHA256 using ATTEMPT_TOKEN_SECRET
- Payload fields:
  - tenant_id
  - session_id
  - distinct_id
  - exp (unix seconds)
- Functions:
  - issueAttemptToken(payload, ttlSeconds)
  - verifyAttemptToken(token): returns payload or throws

Env vars:
- ATTEMPT_TOKEN_SECRET (required in production)
- ATTEMPT_TOKEN_TTL_SECONDS (default 172800)

Task B: Issue token at attempt creation
- Update the test start route so it:
  - Creates session_id
  - Issues attempt_token
  - Returns attempt_token in the JSON response
  - Also sets it in a cookie as a convenience fallback

Task C: Require token on event routes
- For all attempt-scoped routes, require valid attempt_token:
  - page_view
  - share_click
  - upsell_view, upsell_accept
  - test_complete
  - checkout_start
- Validation rules:
  - token must be valid and not expired
  - token tenant_id, session_id, distinct_id must match the request context
- If invalid, return 401 and do not emit events.

Task D: Add replay protection
D1) event_id handling
- Accept event_id in request body for event routes.
- If event_id is missing, generate one server-side and include it in the emitted event properties.

D2) Dedup store
- Add a best-effort dedup cache keyed by event_id with TTL 24 hours.
- Prefer a shared store if you already have one; otherwise use an in-memory TTL cache as a minimal baseline.
- If event_id was seen, return 200 but do not re-emit the PostHog event.

Task E: Tests
- Unit tests for:
  - token issuance and verification
  - expiry behavior
  - mismatch behavior (wrong tenant_id or distinct_id)
- Integration test:
  - call test_start and get attempt_token
  - call page_view with the token (200)
  - call page_view again with same event_id (200, but only 1 emit)

Success criteria
- Attempt-scoped routes require a valid attempt_token.
- Replay of the same event_id does not produce duplicate events.
- Invalid or expired tokens are rejected with 401.
- Tests pass locally.

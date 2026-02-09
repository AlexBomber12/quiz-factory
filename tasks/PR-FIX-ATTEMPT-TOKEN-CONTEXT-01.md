PR-FIX-ATTEMPT-TOKEN-CONTEXT-01: Fix /api/test/complete 401 by making attempt token context host/tenant resolution consistent (strip port, honor forwarded host)

Read and follow AGENTS.md strictly.

Problem (repro)
- Completing a test fails in the browser: POST /api/test/complete returns 401 Unauthorized.
- Response body: {"error":"Attempt token does not match request context."}
- This blocks users from finishing tests.
- Deployment environment uses a host with an explicit port (e.g., quizfactory.lan:3000) and may later sit behind a reverse proxy.

Root cause hypothesis to validate in code
- attempt_token context compares tenant_id/session_id/distinct_id.
- tenant_id is derived via resolveTenant(request.headers, url.host) in multiple API routes.
- url.host includes the port; other parts of the app may use hostname without port, causing tenant mismatch and therefore attempt_token mismatch.
- Additionally, in proxy scenarios X-Forwarded-Host may be present and must be normalized consistently.

Goal
- Make tenant resolution and attempt token context stable regardless of whether the request host includes a port.
- Ensure /api/test/complete succeeds (HTTP 200) when accessed as http://quizfactory.lan:3000 and when later proxied (X-Forwarded-Host / X-Forwarded-Proto).
- Do not weaken security: keep the same intent of replay/context protection; only normalize host parsing so the same request context is computed consistently.

Required changes
1) Introduce a single helper for “effective request host for tenant/security decisions”.
   - Location suggestion: apps/web/src/lib/security/request_host.ts (or within tenants/resolve if you prefer).
   - Inputs: request headers + URL (or string host).
   - Output: normalized hostname string without port.
   - Rules:
     - Prefer X-Forwarded-Host when TRUST_X_FORWARDED_HOST is enabled; otherwise use Host header; otherwise fall back to URL host.
     - If multiple forwarded hosts are present (comma-separated), use the first.
     - Strip port if present (e.g., quizfactory.lan:3000 -> quizfactory.lan).
     - Lowercase and trim.
2) Update all callers that currently pass new URL(request.url).host or url.host into resolveTenant to use the normalized hostname (or refactor resolveTenant to do the normalization internally and accept host-with-port safely).
   - At minimum update:
     - apps/web/src/lib/analytics/server.ts (handleAnalyticsEvent)
     - apps/web/src/app/api/test/score-preview/route.ts
     - the route that handles POST /api/test/complete (find it and update similarly)
     - any other test-related API routes that use resolveTenant(request.headers, url.host)
3) Ensure request guard allowlist checks are consistent with the same normalization (optional but recommended):
   - assertAllowedHost / assertAllowedOrigin should not break on ports when the domain is allowlisted without ports.
   - If these already normalize, ensure they use the same helper to avoid future drift.
4) Add/extend tests:
   - Update apps/web/src/lib/security/attempt_token.test.ts (or add new tests) to cover:
     - tenant resolution produces the same tenant_id for quizfactory.lan and quizfactory.lan:3000
     - attempt token issued under one host validates under the same host with port, assuming same session_id/distinct_id
   - Add a focused unit test for the new host normalization helper:
     - Host: quizfactory.lan:3000 -> quizfactory.lan
     - X-Forwarded-Host: quizfactory.lan:3000 -> quizfactory.lan (when TRUST_X_FORWARDED_HOST is true)
5) Keep behavior secure:
   - Do not remove tenant_id/session_id/distinct_id checks.
   - Only normalize parsing so the same tenant_id is computed consistently.

Developer workflow
- Create a new branch from main: pr-fix-attempt-token-context-01
- Run the standard repo gates (lint + typecheck + tests/build) before committing.
- Update any docs only if necessary.

Acceptance criteria
- In production build, finishing a test succeeds:
  - POST /api/test/complete returns 200 (no 401).
  - attempt_summaries row count increases after completing a test.
- Works when accessed via http://quizfactory.lan:3000 and remains compatible with a reverse proxy (X-Forwarded-Host).
- CI passes.

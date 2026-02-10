PR-E2E-PLAYWRIGHT-SMOKE-01: Add minimal Playwright E2E smoke that covers Start -> Answer -> Finish (guards against 401 /api/test/complete regressions)

Read and follow AGENTS.md strictly.

Why
- We recently hit a production-blocking regression where finishing a test failed: POST /api/test/complete returned 401 due to attempt_token context mismatch.
- Unit tests did not catch it because the failure depends on real browser behavior (Host includes port, cookies/localStorage, fetch sequence).
- Add a minimal, stable Playwright smoke suite that runs in CI and fails fast on such regressions.

Scope (keep small)
- Add 1 smoke test that:
  1) Opens the tenant homepage (baseURL uses host with explicit port, e.g. http://quizfactory.lan:3000).
  2) Starts “Focus Rhythm” (slug focus-rhythm) from the homepage listing or by direct navigation to /t/focus-rhythm.
  3) Completes all questions by selecting the first available answer each time.
  4) Clicks Finish.
  5) Asserts the completion request succeeds and user is routed away from the runner or sees a success state (no error banner).
- Add 1 additional assertion that network call POST /api/test/complete returns 200 (not 401) by waiting for the response.

Environment / determinism
- Use CONTENT_SOURCE=fs with the repo content mounted, so the smoke is self-contained and does not depend on admin publishing.
- Use a known test that exists in the repo content: test-focus-rhythm.
- Ensure the tenant catalog includes tenant-qf-local -> test-focus-rhythm in config/catalog.json for the test environment (do not modify production config; instead add a test-only config or fixture).
- Avoid Stripe, PostHog, BigQuery calls in the smoke path.

Implementation details
1) Test runner setup
- Ensure Playwright is configured in apps/web (it is already a dependency).
- Add a Playwright config if not present:
  - baseURL from env (e.g., PLAYWRIGHT_BASE_URL) defaulting to http://localhost:3000
  - headless: true in CI
  - trace/video: on-first-retry (optional)
- Add scripts in apps/web/package.json:
  - "e2e": "playwright test"
  - "e2e:ui": "playwright test --ui" (optional)
2) Test code
- Place test at: apps/web/e2e/smoke-focus-rhythm.spec.ts (or similar convention in repo).
- Steps:
  - page.goto("/")
  - locate and click Focus Rhythm card/link; if brittle, just goto("/t/focus-rhythm")
  - click Start test (or goto("/t/focus-rhythm/run") if needed)
  - loop questions:
    - click the first answer option button
    - click Next (or handle auto-advance; detect the Finish button on last step)
  - intercept/await response for POST /api/test/complete and assert status 200
  - assert error banner "Unable to finish the test" is not visible
3) CI wiring (minimal)
- Add a GitHub Actions job (or extend existing ci.yml) to run the smoke:
  - Start services via docker compose (content-db + web) in background, with:
    - port 3000 exposed
    - env: TRUST_X_FORWARDED_HOST=true (if needed), CONTENT_SOURCE=fs, CONTENT_DATABASE_URL, etc.
    - volumes: mount ./content and ./config read-only into the web container
  - Wait for /api/health to return 200
  - Run Playwright tests from the repo (either inside a node container or on runner with pnpm)
- Keep this job fast: only run the single smoke test by default (use a test tag or project filter).

Rules
- Do not introduce flakiness: avoid fragile selectors. Prefer data-testid if available; if missing, add stable data-testid attributes on the runner controls (Start, Next, Finish, first option).
- Do not require MCP for CI. MCP is for interactive dev only; CI must run Playwright directly.
- Do not add secrets. Use local env only.
- Keep changes limited to enabling this smoke.

Acceptance criteria
- Running the smoke locally against a running server passes:
  - PLAYWRIGHT_BASE_URL=http://localhost:3000 pnpm --filter @quiz-factory/web e2e
- CI runs the smoke and passes on main.
- The smoke fails if POST /api/test/complete returns 401.

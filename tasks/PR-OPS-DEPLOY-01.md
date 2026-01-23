PR-OPS-DEPLOY-01: Minimal Production Deploy Runbook and Smoke Gates

Read and follow AGENTS.md strictly.

Context
- The app is ready for a 1-tenant MVP deployment with Stripe and PostHog.
- We need a repeatable, low-drama way to deploy staging and prod and to bind domains.
- We also need a lightweight health check for monitoring and a smoke test script that can be run before merging and after deploy.

Goal
- Add documentation and minimal code required for a reproducible production deploy.

Scope
1) Deployment documentation
- Add docs/ops/deploy.md describing:
  - target deployment platform assumptions used by the repo today (detect from existing config; do not invent new infra).
  - required environment variables (non-secret list, secret list by name only).
  - steps to deploy a staging environment and a production environment.
  - domain binding steps for a new tenant domain.
  - Stripe webhooks setup steps (endpoint URL, signing secret placement).
  - PostHog connection settings.
  - rollback strategy.

2) Health endpoint
- Add a simple endpoint /api/health that returns JSON with:
  - status: ok
  - commit_sha (if available via env)
  - server_time
- Do not include secrets or configuration values.

3) Environment validation
- Add a startup-time validation utility used by server routes that require Stripe keys and secrets.
- It must fail fast with a clear error message if a required env var is missing.
- Keep it minimal and only validate vars used in production flows.

4) Smoke test script
- Add a script scripts/smoke.sh (or similar) that can be run locally or in CI to check:
  - GET /api/health returns ok
  - GET /robots.txt and /sitemap.xml return 200
  - POST /api/page/view returns 200 under dev allowlist mode
- The script must support base URL parameter.

Constraints
- Do not introduce new infrastructure providers in this PR.
- Do not commit secrets.

Workflow rules
- Create a new branch from main named: pr-ops-deploy-01
- Implement only what this task requests.
- Run the project test gate per AGENTS.md.

Definition of Done
- docs/ops/deploy.md exists and is actionable.
- /api/health exists and is safe.
- Missing required env vars fail fast in the relevant routes.
- Smoke script works against localhost and can be pointed to a deployed environment.
- Tests and lint pass and the PR is ready to merge.

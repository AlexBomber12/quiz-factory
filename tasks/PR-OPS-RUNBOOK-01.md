PR-OPS-RUNBOOK-01: Ops Runbook Finishing (standalone, analytics mode, verify)

Branch name: pr/ops-runbook-01-verify

Context
You are working in the Quiz Factory monorepo. This PR documents and operationalizes the current deployment and admin analytics modes so running the platform is predictable (standalone server entrypoint, analytics provider selection, and verification). Implement only what is listed in this task. Do not ask follow-up questions.

Global constraints
- Do not commit secrets. Do not add or modify real .env files.
- Keep changes minimal and scoped to docs and scripts.
- Scripts must be safe-by-default and not destroy data.

Implementation tasks
1) Deploy runbook updates
- Update docs/deploy/* to include:
  - Correct way to run the web server with output: "standalone" (Docker compose path and manual node entrypoint).
  - How to run migrations (content DB) and verify schema is up to date.
  - How to configure admin analytics mode:
    - ADMIN_ANALYTICS_MODE override (bigquery|content_db|mock)
    - BigQuery required env vars
    - Content DB required env vars
  - Common troubleshooting:
    - tenant domains allowlist regeneration (tenants.csv -> tenants.json)
    - host/proxy headers guidance (TRUST_X_FORWARDED_HOST)

2) Environment template updates
- Update .env.production.example:
  - Add ADMIN_ANALYTICS_MODE (names only, no secrets)
  - Add CONTENT_DATABASE_URL mention (names only)
  - Add a short note that Stripe webhook requires STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET

3) Verification script
- Add scripts/ops/verify_admin_analytics.sh:
  - Print whether BigQuery env is configured.
  - Print whether CONTENT_DATABASE_URL is configured.
  - Print which analytics provider would be selected (based on the same rules as code).
  - If CONTENT_DATABASE_URL present:
    - run a simple Postgres query via node + pg (do not require psql):
      - SELECT COUNT(*) FROM analytics_events;
      - SELECT COUNT(*) FROM stripe_purchases;
      - SELECT COUNT(*) FROM tenant_tests;
    - if tables are missing, print a clear hint to run migrations.
  - Exit non-zero only on clear misconfiguration (optional; keep it informative).

4) Operator checklist
- Add a short operator checklist section:
  - confirm /api/health
  - confirm /admin/login loads
  - confirm /admin/analytics shows non-mock mode (if configured)
  - confirm Stripe webhook is receiving events

Success criteria
- Runbook clearly explains how to run and verify the system.
- verify_admin_analytics.sh runs without requiring extra tools beyond node and repo dependencies.
- No code behavior changes besides scripts/docs.

Local verification (run and report in PR description)
- ./scripts/ops/verify_admin_analytics.sh (with and without CONTENT_DATABASE_URL set)
- pnpm --filter @quiz-factory/web build

Commit message
PR-OPS-RUNBOOK-01: Ops Runbook Finishing (standalone, analytics mode, verify)

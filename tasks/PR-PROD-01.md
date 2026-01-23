PR-PROD-01: Dev and Prod Host Allowlist Strategy (Local Dev Without 403)

Read and follow AGENTS.md strictly.

Context
- The app enforces Host and Origin allowlists for public /api routes using tenant domains from config/tenants.json.
- This is correct for production.
- For local development, localhost:3000 calls are blocked unless tenants files are manually edited, which is error-prone and breaks automation.

Goal
- Introduce an allowlist mode switch that makes local dev work out-of-the-box but keeps production strict.
  - In production mode, behavior stays exactly the same as today (only tenant domains in config/tenants.json are allowed).
  - In non-production mode, allow localhost and loopback addresses (localhost, 127.0.0.1, ::1) with any port for both Host and Origin checks.
  - Optional: support an env var EXTRA_ALLOWED_HOSTS (comma-separated) honored only in non-production.
- Ensure the allowlist logic remains centralized and reusable by all API routes.

Constraints
- Do not weaken production security. Production must still reject unknown hosts with 403.
- Do not log raw IPs. Do not add any new PII capture.
- Keep method allowlist, body size limits, rate limiting, and other guards unchanged.

Implementation notes
- Locate the existing allowlist functions (assertAllowedHost/assertAllowedOrigin or similar).
- Implement helpers in the same module:
  - getAllowlistMode() returning "prod" or "dev"
  - normalizeHostHeader(hostHeader) and normalizeOrigin(originHeader)
  - isAllowedHost(host) and isAllowedOrigin(origin) with dev exceptions.
- Dev rule: allow missing Origin (some tools) only when in dev mode.
- Add unit tests covering:
  - production: unknown host rejected
  - dev: localhost allowed without adding to tenants.json
  - dev: EXTRA_ALLOWED_HOSTS works
- Add a short runbook doc: docs/ops/dev-allowlist.md.

Workflow rules
- Create a new branch from main named: pr-prod-01-dev-allowlist
- Implement only what this task requests.
- Run the project test gate per AGENTS.md.

Definition of Done
- Running the web app locally on http://localhost:3000 can call /api/page/view and /api/test/start without 403, without editing tenants files.
- In production mode, unknown hosts still get 403 for event routes.
- All existing guards remain active.
- Tests and lint pass and the PR is ready to merge.

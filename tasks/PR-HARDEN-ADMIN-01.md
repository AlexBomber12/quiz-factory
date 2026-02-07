PR-HARDEN-ADMIN-01: Admin Hardening (CSRF, Upload Limits, Staging Publish Safety Rails)

Read and follow AGENTS.md strictly.

Context
- Publishing content directly to production increases risk.
- We need additional safety rails to reduce accidental or malicious publish actions.

Goal
- Harden admin routes and publishing UX with:
  - CSRF protection for all state-changing /api/admin routes
  - strict upload validation and rate limiting for imports
  - an optional staging-first publish workflow guardrail

Non-goals
- Do not redesign the admin UI from scratch.
- Do not add external auth providers in this PR.

Implementation requirements
- CSRF:
  - implement double-submit cookie pattern or equivalent
  - enforce for POST/PUT/DELETE under /api/admin
- Upload hard limits:
  - max_total_bytes 2_000_000
  - max_files 30
  - only .md files
  - reject unexpected locales unless allowlisted by regex
- Rate limit:
  - apply a conservative rate limit for admin upload and publish routes (in-memory is acceptable)
- Staging publish safety:
  - add env var ADMIN_REQUIRE_STAGING_PUBLISH (default off)
  - when enabled, publishing to prod tenants requires that the same version was published to a staging tenant first
  - define staging tenants as tenant_ids prefixed with "staging-" (or use an explicit allowlist env var)

Workflow rules
- Create a new branch from main named: pr-harden-admin-01-csrf-limits
- Implement only what this task requests.

Definition of Done
- CSRF is enforced for all admin mutations.
- Upload and publish endpoints reject invalid payloads early with clear errors.
- Optional staging publish guardrail works when enabled.
- scripts/ci.sh --scope app passes.

PR-ADMIN-01: Admin Auth, RBAC Tokens, and Audit Base

Read and follow AGENTS.md strictly.

Context
- We will publish content directly to production from a WebUI, which increases risk.
- Before uploads/publishing, admin routes must be protected and actions must be auditable.

Goal
- Add a minimal built-in admin auth system for /admin and /api/admin/*:
  - token-based login (no accounts)
  - roles: admin and editor
  - signed httpOnly session cookie with expiry
- Add an admin audit table and helper to log admin actions.

Non-goals
- Do not implement import/upload UI in this PR.
- Do not switch public content to DB in this PR.

Implementation requirements
- Env vars (add to .env.example with empty values):
  - ADMIN_TOKEN
  - EDITOR_TOKEN
  - ADMIN_SESSION_SECRET
- Auth flow:
  - /admin/login page accepts a token
  - if token matches ADMIN_TOKEN -> role=admin
  - if token matches EDITOR_TOKEN -> role=editor
  - set signed httpOnly cookie admin_session with role and expires_at
  - provide logout
- Middleware:
  - protect /admin/* (except /admin/login) and /api/admin/*
  - return 401/redirect to /admin/login
- Audit:
  - add migration for admin_audit_events table:
    - id (uuid), at (timestamp), actor_role, actor_hint (nullable), action, target_type, target_id, meta_json
  - helper function logAdminEvent(...) used by later PRs

Workflow rules
- Create a new branch from main named: pr-admin-01-auth-audit
- Implement only what this task requests.

Definition of Done
- /admin/login works locally and sets admin_session cookie.
- Protected admin routes require auth (middleware enforced).
- admin_audit_events table exists via migrations and a helper is available.
- scripts/ci.sh --scope app passes.

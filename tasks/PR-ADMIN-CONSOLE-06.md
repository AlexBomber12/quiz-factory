PR ID: PR-ADMIN-CONSOLE-06
Title: Audit Log Page + Event Instrumentation
Branch: pr/admin-console-06-audit-log

You are an autonomous coding agent working in this repo. Implement exactly what is requested. Do not ask questions. Keep changes minimal and safe.

Goal
Add an admin audit log page and ensure key admin actions are recorded in admin_audit_events.

Context
- Table admin_audit_events exists in the content DB.
- There is an admin auth system based on ADMIN_TOKEN/EDITOR_TOKEN and signed session cookies.
- Existing admin API routes perform actions (login/logout, imports upload, convert, publish, rollback).

Implementation tasks
1) Implement /admin/audit page.
- File: apps/web/src/app/admin/audit/page.tsx
- Render a table of recent audit events (most recent first). Columns:
  - occurred_at
  - actor (created_by)
  - action
  - entity_type
  - entity_id
  - metadata summary (small, truncated JSON)
- Add simple filtering via searchParams:
  - q matches entity_id or action or actor
  - action exact match filter (optional)

2) Add DB query helpers.
- Use an existing module if present (apps/web/src/lib/admin/audit.ts) or create it.
- Export functions:
  - listAdminAuditEvents({ q, action, limit, offset })
  - logAdminEvent({ actor, action, entity_type, entity_id, metadata })
- Ensure metadata is stored as jsonb and keep payloads small.

3) Instrument admin actions.
Add logAdminEvent(...) calls to these routes (after successful action):
- apps/web/src/app/api/admin/login/route.ts (action: admin_login)
- apps/web/src/app/api/admin/logout/route.ts (action: admin_logout)
- apps/web/src/app/api/admin/imports/route.ts (action: import_uploaded)
- apps/web/src/app/api/admin/imports/[id]/route.ts when conversion to draft succeeds (action: import_converted)
- apps/web/src/app/api/admin/publish/route.ts (action: test_published)
- apps/web/src/app/api/admin/rollback/route.ts (action: test_rollback)
Use stable entity_type values: tenant, test, import, version.
Entity_id should be the primary id (tenant_id, test_id, import_id, version_id).
Actor should be derived from the admin session payload (role and token identity if available). If only role is available, store role.

4) Navigation.
- File: apps/web/src/components/admin/AdminShell.tsx
- Make “Audit” a clickable nav link to /admin/audit.

Non-goals
- No schema changes.
- No analytics dashboards.

Test plan
- pnpm --filter @quiz-factory/web typecheck
- pnpm --filter @quiz-factory/web test
- Manual:
  - Log in to admin, verify an audit row appears for admin_login.
  - Upload an import, verify import_uploaded.
  - Convert import to draft, verify import_converted.
  - Publish and rollback, verify events.
  - Open /admin/audit and verify filtering works.

Success criteria
- /admin/audit exists and shows recent events.
- All listed actions write audit rows on success.
- Audit metadata is small and does not include secrets or raw markdown content.

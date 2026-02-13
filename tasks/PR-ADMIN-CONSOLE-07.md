PR ID: PR-ADMIN-CONSOLE-07
Title: Admin Guardrails (Diagnostics + Publish Safety)
Branch: pr/admin-console-07-guardrails

You are an autonomous coding agent working in this repo. Implement exactly what is requested. Do not ask questions. Keep changes minimal and safe.

Goal
Add basic guardrails so admin users do not accidentally publish broken content or publish into a misconfigured environment. Provide a small diagnostics panel in the admin dashboard.

Context
- Admin actions exist (publish/rollback) and can affect live tenants.
- Content source can be fs or db; for production operations, db is expected.

Implementation tasks
1) Diagnostics panel on /admin.
- File: apps/web/src/app/admin/page.tsx
- Add a “Diagnostics” section/card that shows:
  - NODE_ENV
  - COMMIT_SHA (if present)
  - CONTENT_SOURCE (resolved value)
  - CONTENT_DATABASE_URL configured: yes/no (do not print the URL)
  - Tenants registry count (from config/tenants.json)
  - Content DB migrations applied: yes/no (check applied_migrations table exists and has at least 1 row)
- If any critical item is missing, show a warning callout.

2) Publish safety checks (server-side).
- File: apps/web/src/app/api/admin/publish/route.ts
- Add validations before performing publish:
  - tenant_id must exist in config/tenants.json
  - version_id must exist and belong to the provided test_id
  - version spec_json must include locales.en (minimum) and required fields used by the public site
  - if any validation fails, return 400 with a clear error message
- Do not weaken security or CSRF.

3) Rollback safety checks (server-side).
- File: apps/web/src/app/api/admin/rollback/route.ts
- Validate tenant_id exists and target version_id belongs to the test being rolled back.

4) UI affordances.
- File: apps/web/src/components/admin/TestPublishPanel.tsx
- If the diagnostics indicate DB is not configured or content source is fs, disable publish/rollback actions and show a message explaining what to configure.

Non-goals
- No new schemas.
- No staging workflows.

Test plan
- pnpm --filter @quiz-factory/web typecheck
- pnpm --filter @quiz-factory/web test
- Manual:
  - Open /admin and verify diagnostics renders.
  - Temporarily unset CONTENT_DATABASE_URL and confirm diagnostics warns and publish actions are disabled.
  - Attempt publish with invalid tenant_id and confirm 400.

Success criteria
- /admin shows a clear diagnostics section.
- Publish/rollback endpoints reject invalid tenant/version/test combinations with 400.
- Admin UI prevents obvious misconfigurations from causing silent bad publishes.

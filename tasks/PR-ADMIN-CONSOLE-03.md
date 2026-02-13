PR ID: PR-ADMIN-CONSOLE-03
Title: Tests Registry Page (Admin)
Branch: pr/admin-console-03-tests-registry

You are an autonomous coding agent working in this repo. Implement exactly what is requested. Do not ask questions. Keep changes minimal and safe.

Goal
Add a Tests registry page at /admin/tests that shows all known tests, their latest version, locale coverage, and where they are published. Keep it DB-driven (content DB).

Context
- Content DB tables exist (tests, test_versions, tenant_tests).
- /admin/imports flow already exists.
- Admin shell and /admin/imports index exist from previous PRs.

Implementation tasks
1) Create Tests registry page.
- File: apps/web/src/app/admin/tests/page.tsx
- Render a table (most recently updated first if possible). Columns:
  - test_id
  - slug
  - latest version number (or latest version_id)
  - locales (from latest version spec_json locales keys, comma separated)
  - published tenants count
  - quick actions:
    - “Open” (link to /admin/tests/[test_id])
- Add a search input via query param q (matches test_id or slug).

2) Add a minimal placeholder test detail route to avoid 404 until PR-ADMIN-CONSOLE-04.
- File: apps/web/src/app/admin/tests/[test_id]/page.tsx
- Show test_id and a short “Detail page coming next PR” message.
- Do not add functionality here (that is PR-ADMIN-CONSOLE-04).

3) Add a DB query helper to list tests.
- Create a new module: apps/web/src/lib/admin/tests.ts
- Export: listAdminTests(options) returning rows for the table.
- The query must be efficient:
  - Do not select full spec_json.
  - It is acceptable to fetch locales as JSON keys only.
  - Compute published tenants count from tenant_tests.
- Keep SQL readable and covered by basic error handling.

4) Update admin navigation.
- File: apps/web/src/components/admin/AdminShell.tsx
- Add a clickable “Tests” nav link to /admin/tests.
- Keep Tenants and Audit as non-clickable placeholders for now.

Non-goals
- No schema changes.
- No publish/rollback actions on this page (they come in PR-ADMIN-CONSOLE-04/05).

Test plan
- pnpm --filter @quiz-factory/web typecheck
- pnpm --filter @quiz-factory/web test
- Manual:
  - Open /admin/tests and verify it loads.
  - Verify q filtering.
  - Click Open for a row and confirm placeholder page renders.

Success criteria
- /admin/tests exists and lists tests from the DB.
- Admin nav includes Tests and does not introduce 404 links.
- The list does not load entire spec_json blobs.

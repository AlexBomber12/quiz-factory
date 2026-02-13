PR ID: PR-ADMIN-CONSOLE-04
Title: Test Detail Page (Versions + Publish Status)
Branch: pr/admin-console-04-test-detail

You are an autonomous coding agent working in this repo. Implement exactly what is requested. Do not ask questions. Keep changes minimal and safe.

Goal
Implement /admin/tests/[test_id] as a real test detail page. It must show versions for the test and where the test is published (per tenant), and allow publish/rollback/enable actions using existing admin API routes.

Context
- /admin/tests exists (registry) and links here.
- Existing admin API routes exist for publish and rollback (and tenant enable toggle if present).
- Tenants registry source is config/tenants.json.
- Content DB tables: tests, test_versions, tenant_tests.

Implementation tasks
1) Replace the placeholder page with a real detail page.
- File: apps/web/src/app/admin/tests/[test_id]/page.tsx
- Server-rendered page that loads:
  - Test row (test_id, slug)
  - All versions for this test (most recent first)
  - Publication status per tenant (tenant_id, enabled, published_version_id)
- UI sections:
  - Header: test_id, slug, quick links to public pages (relative links are fine): /t/<slug> and /tests
  - Versions table: version_id, version number, status, created_at, created_by, checksum
  - Published on tenants table: tenant_id, enabled, published_version_id, domains (from config/tenants.json)

2) Add data helpers.
- Extend apps/web/src/lib/admin/tests.ts
- Add functions:
  - getAdminTestDetail(test_id) -> { test, versions, publications }
  - Ensure queries do not pull full spec_json unless needed.

3) Add client-side action panel for publish/rollback/enable.
- Add a client component: apps/web/src/components/admin/TestPublishPanel.tsx
- It receives:
  - tenant list (tenant_id + domains)
  - versions list (version_id + version)
  - current publications
- Actions:
  - Publish: select tenant_id and version_id, call existing POST /api/admin/publish
  - Rollback: select tenant_id and version_id, call existing POST /api/admin/rollback
  - Enable toggle: if an endpoint exists in the repo today, wire it; if not, omit toggle here (do not create new endpoints in this PR).
- After an action succeeds, refresh the page (router.refresh) and show a success toast or inline message.
- Do not leak secrets. Use existing CSRF/session mechanisms.

4) Navigation polish.
- In apps/web/src/components/admin/AdminShell.tsx, keep Tests link active.
- Do not add Tenants/Audit links yet (those come in later PRs).

Non-goals
- No schema changes.
- No new analytics pages.
- Do not redesign the public site.

Test plan
- pnpm --filter @quiz-factory/web typecheck
- pnpm --filter @quiz-factory/web test
- Manual:
  - Open /admin/tests/<test_id>
  - Publish an existing version to the existing tenant
  - Verify the public /tests and /t/<slug> show the test
  - Rollback to a previous version and verify the public page updates

Success criteria
- /admin/tests/[test_id] shows versions and per-tenant publish status.
- Publish and rollback work from this page using existing API routes.
- No regressions to /admin import flow.

PR ID: PR-ADMIN-CONSOLE-05
Title: Tenants Registry + Tenant Detail (Publications)
Branch: pr/admin-console-05-tenants-pages

You are an autonomous coding agent working in this repo. Implement exactly what is requested. Do not ask questions. Keep changes minimal and safe.

Goal
Add tenant-centric admin pages:
- /admin/tenants: a registry of tenants (sites)
- /admin/tenants/[tenant_id]: what tests are published on that tenant
This PR is focused on visibility and navigation. Do not add new publish endpoints.

Context
- Tenant registry source is config/tenants.json (read-only in this PR).
- Publications are stored in content DB table tenant_tests.
- Tests registry and test detail pages exist from previous PRs.

Implementation tasks
1) Tenants registry page.
- File: apps/web/src/app/admin/tenants/page.tsx
- Render a table of tenants from config/tenants.json. Columns:
  - tenant_id
  - domains (comma separated)
  - default_locale
  - published tests count (from DB tenant_tests where enabled = true)
  - link: “Open” -> /admin/tenants/[tenant_id]

2) Tenant detail page.
- File: apps/web/src/app/admin/tenants/[tenant_id]/page.tsx
- Show tenant header: tenant_id, domains, default_locale.
- Render a table of published tests for this tenant. Columns:
  - test_id
  - slug
  - published_version_id
  - enabled
  - link: “Open test” -> /admin/tests/[test_id]

3) Data helpers.
- Create: apps/web/src/lib/admin/tenants.ts
- Export:
  - listAdminTenantsWithCounts() -> list of tenants enriched with published_count
  - getAdminTenantDetail(tenant_id) -> tenant metadata + list of published tests
- Queries must not load full spec_json.

4) Navigation.
- File: apps/web/src/components/admin/AdminShell.tsx
- Make “Tenants” a clickable nav link to /admin/tenants.
- Keep “Audit” as non-clickable placeholder for now.

Non-goals
- No tenant editing in UI (still file-based).
- No new publish/rollback actions here (use /admin/tests/[test_id] for actions).

Test plan
- pnpm --filter @quiz-factory/web typecheck
- pnpm --filter @quiz-factory/web test
- Manual:
  - Open /admin/tenants and verify list.
  - Open a tenant detail page and verify published tests list.
  - Follow “Open test” link to the test detail page.

Success criteria
- /admin/tenants and /admin/tenants/[tenant_id] exist and do not 404.
- You can see, for each tenant, which tests are published and which version.
- Admin navigation now includes Tenants.

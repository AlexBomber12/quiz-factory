PR-ADMIN-CONSOLE-09: Publications Registry (Tenant x Test Matrix)

Branch name: pr/admin-console-09-publications

Context
You are working in the Quiz Factory monorepo. This PR adds an operational Publications registry page that answers “which test is published on which tenant, which version, and whether it is enabled”. Implement only what is listed in this task. Do not ask follow-up questions.

Global constraints
- Do not commit secrets. Do not add or modify .env files.
- Keep changes minimal and scoped to this PR.
- Reuse existing UI primitives and AdminShell.
- Preserve RBAC: page and export endpoints require a valid admin_session.
- Prefer server-side data loading; use client components only for small actions (toggle/export).
- Do not redesign publish workflow. Reuse existing /api/admin/publish and /api/admin/rollback endpoints.

Implementation tasks
1) Navigation
- Add a new Admin navigation item “Publications” that routes to /admin/publications.

2) Data access layer
- Add lib/admin/publications.ts with:
  - type AdminPublicationRow:
    - tenant_id, domains[], test_id, slug, published_version_id|null, is_enabled, updated_at|null (if available)
  - function listAdminPublications(filters):
    - filters: q (search), tenant_id, test_id, only_published (bool), only_enabled (bool)
    - joins content DB tables:
      - tenant_tests tt
      - tests t
    - merges in domains from config/tenants.json (same approach as lib/admin/tenants.ts)
    - sorts stable: tenant_id, slug, test_id
  - keep filtering conservative and safe (sanitize q, limit max length).

3) /admin/publications page
- Server component page with session check (same pattern as /admin/tests).
- Filter UI (GET params):
  - q (search across tenant_id, test_id, slug, domain)
  - only_published (checkbox)
  - only_enabled (checkbox)
- Table columns:
  - tenant_id, domains, test_id, slug, published_version_id, enabled
  - links: admin tenant, admin test, tenant analytics, test analytics, public URL (if domain exists)
- Empty state message when no rows.

4) Enable toggle (small action)
- For rows that have published_version_id:
  - Add a small client-side “Enable/Disable” button.
  - Reuse the JSON publish endpoint:
    - POST /api/admin/publish
    - payload: test_id, version_id=published_version_id, tenant_ids=[tenant_id], is_enabled=<toggled>
  - Use existing CSRF token header pattern (same as TestPublishPanel).
  - On success: router.refresh().

5) CSV export
- Add GET /api/admin/publications/export (or /api/admin/publications.csv)
  - Requires admin_session (admin or editor is fine for export).
  - Returns text/csv with header row.
  - Uses the same query as listAdminPublications (server-side), applying current filters passed as query params.
- On /admin/publications add “Export CSV” link/button that points to the export endpoint with current query params.

Success criteria
- /admin/publications shows the complete mapping tenant x test with published version and enabled state.
- Enable toggle updates state for that tenant/test without leaving the page.
- CSV export downloads a file that matches the currently applied filters.
- No regressions to existing admin flows.

Local verification (run and report in PR description)
- pnpm --filter @quiz-factory/web lint
- pnpm --filter @quiz-factory/web typecheck
- pnpm --filter @quiz-factory/web test
- pnpm --filter @quiz-factory/web build
- ./scripts/smoke.sh http://localhost:3000

Commit message
PR-ADMIN-CONSOLE-09: Publications Registry (Tenant x Test Matrix)

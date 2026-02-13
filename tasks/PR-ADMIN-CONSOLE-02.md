PR ID: PR-ADMIN-CONSOLE-02
Title: Imports Index (List + Filters)
Branch: pr/admin-console-02-imports-index

You are an autonomous coding agent working in this repo. Implement exactly what is requested. Do not ask questions. Keep changes minimal and safe.

Goal
Add an Imports index page at /admin/imports that lists uploaded imports, with basic filtering and links to the existing import detail page. This PR must not change the existing import upload and conversion logic.

Context
- Existing routes already present:
  - /admin/imports/new (upload)
  - /admin/imports/[id] (detail and convert)
- Content DB table: imports
- Admin shell created in PR-ADMIN-CONSOLE-01

Implementation tasks
1) Create Imports index page.
- File: apps/web/src/app/admin/imports/page.tsx
- Render a table of recent imports (most recent first). Columns:
  - import_id
  - source_test_id (or blank)
  - locales detected in files_json (comma separated)
  - status
  - created_at
  - created_by (if present)
  - link: “Open” -> /admin/imports/[id]
- Add a primary button “Create import bundle” linking to /admin/imports/new.
- Add search/filter controls:
  - q: free-text search (matches import_id or source_test_id)
  - status: optional filter (uploaded, converted, failed)
  - Keep it simple and server-rendered (use searchParams).

2) Add a lightweight DB query helper for listing imports.
- Prefer adding an exported function in an existing admin module (for example apps/web/src/lib/admin/imports.ts) or create a new small module apps/web/src/lib/admin/imports_list.ts.
- The query must NOT select the full files_json payload (can be large). Select only fields needed for the list.
- Extract locales from files_json without loading full markdown contents in memory. It is acceptable to compute locales in SQL by reading JSON keys if files_json is stored as jsonb.

3) Update admin navigation link.
- File: apps/web/src/components/admin/AdminShell.tsx
- Change the “Imports” nav link to /admin/imports (instead of /admin/imports/new).

Non-goals
- No schema changes.
- No changes to import upload, conversion, or publish endpoints.

Test plan
- pnpm --filter @quiz-factory/web typecheck
- pnpm --filter @quiz-factory/web test
- Manual:
  - Open /admin/imports, confirm list loads.
  - Create a new import via /admin/imports/new, confirm it appears in the list.
  - Open an import detail page from the list.
  - Verify q and status filters work.

Success criteria
- /admin/imports exists and does not 404.
- Imports nav link points to /admin/imports.
- The list is stable and does not load full markdown blobs.
- Existing import flow remains unchanged.

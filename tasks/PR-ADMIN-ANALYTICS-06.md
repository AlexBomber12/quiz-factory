PR-ADMIN-ANALYTICS-06: Distribution Matrix (Tenant x Test) + Quick Metrics

Branch name: pr/admin-analytics-06-distribution

Context
You are working in the Quiz Factory monorepo. This PR is part of Admin Stage 2 (Analytics). Implement only what is listed in this task. Do not ask follow-up questions. Make reasonable, conservative assumptions, document them briefly in the PR description, and proceed.

Global constraints
- Do not commit secrets. Do not add or modify .env files.
- Keep changes minimal and scoped to this PR.
- Reuse existing UI primitives (Tailwind + shadcn/ui) and existing admin layout/navigation.
- Prefer querying aggregated marts over raw events (cost and performance).
- Ensure multi-tenant correctness: every query is filtered by tenant_id when relevant.
- Validate inputs on server routes (dates, IDs, enums) and return stable JSON shapes.
- Add basic unit tests where practical (at least for pure functions and validation).

Implementation tasks
1) Implement Distribution matrix (tenant x test)
Endpoint:
- GET /api/admin/analytics/distribution

Response must include:
- rows keyed by tenant_id
- columns keyed by test_id
- for each cell:
  - is_published (boolean, derived from marts or content DB if needed)
  - version_id (if available from content DB)
  - enabled (if available)
  - 7d net revenue, 7d paid conversion (computed from marts within the selected range)

Implementation notes:
- Prefer pulling publication state from the content DB tables (tenant_tests + test_versions) if available in web app.
- Metrics come from marts.
- Keep the matrix bounded:
  - Default to top 20 tenants and top 20 tests by revenue within range.
  - Allow overriding via query params top_tenants/top_tests (validated, max 50).

2) UI
- /admin/analytics/distribution
  - render as a scrollable table
  - sticky header and first column
  - each cell links to the tenant detail filtered by test_id (or test detail filtered by tenant_id)

3) Tests
- Unit tests for bounding logic and query param validation


Success criteria
- The PR builds successfully.
- Existing tests pass, and you add/adjust tests as required by this task.
- The feature works end-to-end as described above with a clear manual verification checklist.
- No regressions to existing admin flows (login, imports, publish).

Local verification (run and report in PR description)
- pnpm --filter @quiz-factory/web lint
- pnpm --filter @quiz-factory/web typecheck
- pnpm --filter @quiz-factory/web test
- pnpm --filter @quiz-factory/web build
- ./scripts/smoke.sh http://localhost:3000

Commit message
PR-ADMIN-ANALYTICS-06: Distribution Matrix (Tenant x Test) + Quick Metrics

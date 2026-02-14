PR-ADMIN-ANALYTICS-02: Admin Analytics API Contract + Provider Abstraction

Branch name: pr/admin-analytics-02-api-contract

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
1) Create Admin Analytics API route skeletons with stable JSON contracts
Add endpoints under apps/web/src/app/api/admin/analytics:
- GET /api/admin/analytics/overview
- GET /api/admin/analytics/tests
- GET /api/admin/analytics/tests/[test_id]
- GET /api/admin/analytics/tenants
- GET /api/admin/analytics/tenants/[tenant_id]
- GET /api/admin/analytics/distribution
- GET /api/admin/analytics/traffic
- GET /api/admin/analytics/revenue
- GET /api/admin/analytics/data

Notes:
- These routes are under /api/admin so they are already protected by existing admin middleware.
- All endpoints must accept the same filter query params as FilterBar (start/end/tenant_id/test_id/locale/device_type/utm_source).
- Implement strict parsing + validation for query params. If invalid, return 400 with a clear error JSON.

2) Define shared TypeScript types for responses and filters
- Create a module (for example apps/web/src/lib/admin_analytics/types.ts):
  - AdminAnalyticsFilters (parsed, normalized)
  - Response types for each endpoint
  - Common helper types (KpiCard, TimeseriesPoint, FunnelStep, TableRow)
- Add runtime validation for filters (no external libs required; implement small validators).

3) Implement provider abstraction and 2 providers
- Create apps/web/src/lib/admin_analytics/provider.ts:
  - interface AdminAnalyticsProvider with methods matching the endpoints
  - function getAdminAnalyticsProvider() that chooses provider based on env + availability:
    - If BIGQUERY_PROJECT_ID is set (and required dataset envs exist), use BigQuery provider
    - Else use Mock provider

- Create apps/web/src/lib/admin_analytics/providers/mock.ts:
  - Return deterministic, realistic fake data shaped exactly like the response types.
  - Fake data must be stable for a given filter range (do not use random).

- Create apps/web/src/lib/admin_analytics/providers/bigquery.ts (skeleton only in this PR):
  - Set up a BigQuery client using existing patterns in the repo (or create a small wrapper).
  - For now, it can return not implemented errors for each method, but must compile.
  - Do not introduce new env vars. Use the env vars that already exist in deploy.md (BigQuery project/dataset names).
  - The purpose of this PR is to lock the contract and wiring, not to implement queries.

4) Wire API routes to the provider
- Each API endpoint calls provider.method(filters) and returns JSON.
- Mock provider must make the endpoints return 200.

5) Add tests
- Unit test filter parsing/validation
- Unit test that mock provider returns valid shapes for all endpoints


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
PR-ADMIN-ANALYTICS-02: Admin Analytics API Contract + Provider Abstraction

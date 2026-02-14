PR-ADMIN-ANALYTICS-04: Tenants Analytics (List + Detail)

Branch name: pr/admin-analytics-04-tenants

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
1) Implement BigQuery provider for Tenants list + Tenant detail
Endpoints:
- GET /api/admin/analytics/tenants
- GET /api/admin/analytics/tenants/[tenant_id]

Tenants list must return:
- tenant_id
- sessions, starts, completes, purchases
- paid conversion
- net revenue, refunds
- top test_id for that tenant (by net revenue)
- last activity date (max day in range)

Tenant detail must return:
- KPI + funnel for this tenant
- time series for net revenue and sessions (daily points)
- top tests for this tenant (table)
- breakdown by locale (table)

Implementation details:
- Use marts tables, date range filters.
- Keep response sizes bounded (top N = 20).
- Return stable ordering and include total counts.

2) UI wiring
- /admin/analytics/tenants: table with sorting, link to tenant detail
- /admin/analytics/tenants/[tenant_id]: KPI + funnel + charts + top tests table + breakdowns

3) Add guardrails
- If tenant_id in path is empty/invalid, return 400
- If tenant_id not found, return 200 with empty data + No data state (do not 404)

4) Add tests
- Add tests for tenant_id path parsing + response shape checks


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
PR-ADMIN-ANALYTICS-04: Tenants Analytics (List + Detail)

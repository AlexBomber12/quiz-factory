PR-ADMIN-ANALYTICS-05: Tests Analytics (List + Detail)

Branch name: pr/admin-analytics-05-tests

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
1) Implement BigQuery provider for Tests list + Test detail
Endpoints:
- GET /api/admin/analytics/tests
- GET /api/admin/analytics/tests/[test_id]

Tests list must return:
- test_id, slug (if available in marts; else omit slug)
- sessions, starts, completes, purchases
- paid conversion
- net revenue, refunds
- top tenant_id for that test (by revenue)
- last activity date

Test detail must return:
- KPI + funnel for this test
- time series for sessions, completes, purchases, net revenue (daily points)
- breakdown by tenant (table)
- breakdown by locale (table)
- paywall metrics (views, checkout_starts, checkout_success) if available in marts

Implementation details:
- Use marts tables, date range filters.
- Top N limits and stable ordering.

2) UI wiring
- /admin/analytics/tests: table with search/filter, link to detail
- /admin/analytics/tests/[test_id]: KPI + funnel + charts + breakdown tabs

3) Add tests
- Path param parsing for test_id (pattern test-[a-z0-9-]+)
- Provider returns valid shapes for both endpoints


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
PR-ADMIN-ANALYTICS-05: Tests Analytics (List + Detail)

PR-ADMIN-ANALYTICS-03: Global Analytics Overview (BigQuery) + UI Wiring

Branch name: pr/admin-analytics-03-overview

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
1) Implement BigQuery provider for /overview (global analytics)
Complete the BigQuery provider methods required by GET /api/admin/analytics/overview.

Data sources:
- Prefer marts tables produced by dbt:
  - marts.mart_funnel_daily
  - marts.mart_pnl_daily
  - marts.mart_unit_econ_daily (or equivalent)
  - marts.alert_events (if present, for a simple alerts list)

Behavior:
- Use filters.start/end as inclusive date range.
- If tenant_id is provided, filter to that tenant_id, else aggregate across tenants.
- Compute:
  - KPI cards: sessions/starts/completes/purchases, paid conversion, gross/net, refunds, disputes, fees (where available)
  - Funnel steps (counts + conversion rates) from mart_funnel_daily
  - Top tests by net revenue (and by paid conversion) within date range
  - Top tenants by net revenue within date range
  - Data freshness: max(event_date) from each mart queried (simple, 1 query per mart, cached in memory for 60s)

Implementation details:
- Keep SQL parameterized where possible.
- Return empty but valid structures when no data exists.

2) Update UI: /admin/analytics uses real data
- Implement server-side fetching from /api/admin/analytics/overview using the current filter querystring.
- Replace placeholder widgets with:
  - KPI grid
  - Funnel table
  - Top tests table
  - Top tenants table
  - Alerts list (optional; if no alerts table exists, hide the section)

3) Add caching on the API side (small and safe)
- Cache overview response by (filters hash) for 30-60 seconds to reduce BigQuery load.
- Do not cache per-user, only per filters.

4) Add manual QA checklist to PR description
- With data present: metrics appear and update with date range.
- With no data: page renders with zeros/empty tables, no crashes.

5) Add tests
- Unit tests for SQL builder functions (if any)
- Lightweight integration test for provider filter -> query mapping (mock BigQuery client or isolate builder)


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
PR-ADMIN-ANALYTICS-03: Global Analytics Overview (BigQuery) + UI Wiring

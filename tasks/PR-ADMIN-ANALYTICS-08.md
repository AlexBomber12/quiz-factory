PR-ADMIN-ANALYTICS-08: Revenue + Data Health (Stripe + Freshness)

Branch name: pr/admin-analytics-08-revenue-data

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
1) Implement Revenue + Data Health
Endpoints:
- GET /api/admin/analytics/revenue
- GET /api/admin/analytics/data

Revenue endpoint:
- purchases count, gross, net, fees, refunds, disputes
- breakdown by offer_key / pricing_variant (if present)
- breakdown by tenant_id and test_id (top N)
- reconciliation signals if available (Stripe vs internal purchase_success)

Data endpoint:
- data freshness per key table (marts.mart_funnel_daily, marts.mart_pnl_daily, raw Stripe table if present)
- last successful dbt run marker if available (else omit)
- alert_events (recent) if present
- show a clear OK / Warning state based on freshness thresholds (configurable in code, not env)

2) UI
- /admin/analytics/revenue:
  - KPI row
  - breakdown tables
- /admin/analytics/data:
  - freshness cards
  - recent alert events list
  - clear remediation hints (text only, no automation in this stage)

3) Tests
- Response shape tests for both endpoints
- Unit tests for freshness evaluation function (threshold logic)


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
PR-ADMIN-ANALYTICS-08: Revenue + Data Health (Stripe + Freshness)

PR-ADMIN-ANALYTICS-07: Traffic Analytics (UTM, Referrers, Devices, Geo)

Branch name: pr/admin-analytics-07-traffic

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
1) Implement Traffic analytics
Endpoint:
- GET /api/admin/analytics/traffic

Return:
- top utm_source (and optionally utm_campaign) with sessions, purchases, paid conversion, net revenue
- top referrers (if captured) with sessions and conversion
- device_type breakdown
- geo/country breakdown (only if already present in marts and privacy-safe)

Implementation details:
- Use marts tables that already join UTM fields (or a dedicated mart if present).
- Apply all filters, especially date range and tenant_id.
- Bound all lists to top N (default 50, max 200).

2) UI
- /admin/analytics/traffic:
  - sections: Sources, Campaigns, Devices, Countries
  - simple sortable tables and minimal charts (optional)

3) Tests
- Response shape tests and query validation tests


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
PR-ADMIN-ANALYTICS-07: Traffic Analytics (UTM, Referrers, Devices, Geo)

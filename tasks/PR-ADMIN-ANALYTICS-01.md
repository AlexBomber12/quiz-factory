PR-ADMIN-ANALYTICS-01: Analytics UI Skeleton + Global FilterBar

Branch name: pr/admin-analytics-01-skeleton-filterbar

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
1) Add Analytics section to the Admin console navigation
- Locate the existing Admin shell/layout and add a primary nav link "Analytics" pointing to /admin/analytics.
- Keep the current admin style and spacing consistent (no new design system).

2) Add route skeletons (UI only, no real data yet)
Create the following pages under apps/web/src/app/admin/analytics with minimal, clean scaffolding:
- /admin/analytics (global overview placeholder)
- /admin/analytics/tests (tests table placeholder)
- /admin/analytics/tests/[test_id] (test detail placeholder)
- /admin/analytics/tenants (tenants table placeholder)
- /admin/analytics/tenants/[tenant_id] (tenant detail placeholder)
- /admin/analytics/distribution (matrix placeholder)
- /admin/analytics/traffic (traffic placeholder)
- /admin/analytics/revenue (revenue placeholder)
- /admin/analytics/data (data health placeholder)

Each page must:
- Render inside the existing Admin layout.
- Show page title, a short description, and a consistent "Filters" panel placeholder (see next step).
- Include links between related pages (from lists to details) using tenant_id and test_id route params.

3) Implement a shared AdminAnalyticsFilterBar component (UI + querystring sync only)
- Create a reusable component (for example in apps/web/src/components/admin/analytics/FilterBar.tsx).
- It must support these filter controls (UI only for now):
  - date range (start/end, default last 7 days)
  - tenant_id (text input for now, later will become a combobox)
  - test_id (text input for now)
  - locale (select: en, es, pt-BR, all)
  - device_type (select: desktop, mobile, tablet, all)
  - utm_source (text input)
- Sync the filters to the URL querystring:
  - start=YYYY-MM-DD
  - end=YYYY-MM-DD
  - tenant_id=...
  - test_id=...
  - locale=...
  - device_type=...
  - utm_source=...
- Provide a "Reset" button to clear filters back to defaults.
- Provide an "Apply" button that updates the querystring (do not auto-apply on every keystroke).

4) Add a small shared helper for date handling
- Implement a helper module for parsing/formatting YYYY-MM-DD and for computing default ranges.
- Add unit tests for this helper.

5) Manual QA checklist (write into PR description)
- Navigate to each /admin/analytics* page and confirm it renders without errors.
- Change filters and confirm querystring updates; reload and confirm filters restore from querystring.


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
PR-ADMIN-ANALYTICS-01: Analytics UI Skeleton + Global FilterBar

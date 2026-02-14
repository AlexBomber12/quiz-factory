PR-ADMIN-CONSOLE-08: Admin UX Finishing (Deep Links)

Branch name: pr/admin-console-08-ux

Context
You are working in the Quiz Factory monorepo. This PR improves Admin usability by adding deep links between registries, analytics, and public pages. Implement only what is listed in this task. Do not ask follow-up questions. Make conservative assumptions, document them briefly in the PR description, and proceed.

Global constraints
- Do not commit secrets. Do not add or modify .env files.
- Keep changes minimal and scoped to this PR.
- Reuse existing UI primitives (Tailwind + shadcn/ui) and existing admin layout/navigation.
- Preserve RBAC: admin pages must require a valid admin_session.
- Do not change analytics provider behavior in this PR.
- Public links must not require special headers; prefer normal URLs.

Implementation tasks
1) /admin/tests (Tests registry)
- In the actions column, replace the single “Open” link with an inline action group:
  - Open: /admin/tests/<test_id> (existing)
  - Analytics: /admin/analytics/tests/<test_id>
  - Public: /t/<slug> (same host)
- Keep the table readable (use separators like " | " or stacked links with small spacing).

2) /admin/tests/[test_id] (Test detail)
- In the top button row, add:
  - Analytics test: /admin/analytics/tests/<test_id>
  - Analytics distribution: /admin/analytics/distribution
- In “Published on tenants” table:
  - Add a new column “links”.
  - For each tenant row, render:
    - Admin tenant: /admin/tenants/<tenant_id>
    - Tenant analytics: /admin/analytics/tenants/<tenant_id>
    - Public test (only if domains exist): https://<first_domain>/t/<slug>
  - Keep existing columns intact.

3) /admin/tenants (Tenants registry)
- In actions column, render:
  - Open: /admin/tenants/<tenant_id> (existing)
  - Analytics: /admin/analytics/tenants/<tenant_id>
  - Public (only if domains exist): https://<first_domain>/tests

4) /admin/tenants/[tenant_id] (Tenant detail)
- Add buttons:
  - Analytics tenant: /admin/analytics/tenants/<tenant_id>
  - Public /tests links: for each domain render https://<domain>/tests (open in a new tab)
- In “Published tests” table:
  - Add a “public” link column (only if domains exist): https://<first_domain>/t/<slug>

5) Visual consistency
- Use Button asChild variants for button links where appropriate.
- Use Link styling consistent with existing registry tables for inline links.

Success criteria
- From /admin/tests you can reach test analytics and public landing without manual URL edits.
- From test and tenant detail pages you can jump to analytics and to public pages in 1 click.
- No regressions to admin login, imports, and publish workflows.

Local verification (run and report in PR description)
- pnpm --filter @quiz-factory/web lint
- pnpm --filter @quiz-factory/web typecheck
- pnpm --filter @quiz-factory/web test
- pnpm --filter @quiz-factory/web build
- ./scripts/smoke.sh http://localhost:3000

Commit message
PR-ADMIN-CONSOLE-08: Admin UX Finishing (Deep Links)

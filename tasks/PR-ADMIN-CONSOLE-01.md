PR ID: PR-ADMIN-CONSOLE-01
Title: Admin Layout and Navigation Shell
Branch: pr/admin-console-01-layout-nav

You are an autonomous coding agent working in this repo. Implement exactly what is requested. Do not ask questions. Keep changes minimal and safe.

Goal
Create a cohesive admin console shell with a shared layout and navigation. Do not change existing admin functionality (auth, imports flow, publish flow). This PR only introduces the shell so later PRs can add pages cleanly.

Scope
- Add a shared admin layout (UI shell) for /admin routes.
- Add a small navigation component for existing pages.
- Keep /admin/login UX clean (no sidebar).
- Reorganize /admin dashboard content into clearer sections without changing behavior.

Implementation tasks
1) Add a client component AdminShell.
- File: apps/web/src/components/admin/AdminShell.tsx
- Responsibilities:
  - Render a top bar with "Quiz Factory" and an "Admin" label.
  - Render a left nav for authenticated admin pages.
  - Hide the left nav when pathname is /admin/login.
  - The nav must only link to routes that exist after this PR:
    - Dashboard: /admin
    - Imports: /admin/imports/new (label it "Imports")
  - Include placeholders as non-clickable text for future sections (Tests, Tenants, Audit) so users see what is coming, but do not create dead links.

2) Add an App Router layout for /admin.
- File: apps/web/src/app/admin/layout.tsx
- Wrap children with AdminShell.
- Keep styling consistent with existing UI primitives (Tailwind + existing components).

3) Update /admin to look like a dashboard.
- File: apps/web/src/app/admin/page.tsx
- Keep all existing functionality intact (imports button, publish workflow, session controls, etc.).
- Only refactor presentation into clearly labeled sections/cards.
- Ensure the page still renders without extra client-side code.

4) Ensure no new 404s are introduced.
- Nav must not link to routes that do not exist yet.
- Existing admin deep links (/admin/imports/new and /admin/imports/[id]) must continue to work.

Non-goals
- No new database schema changes.
- No changes to admin auth, tokens, CSRF, or API routes.
- No new list pages yet (those come in later PRs).

Test plan
- pnpm --filter @quiz-factory/web typecheck
- pnpm --filter @quiz-factory/web test
- Manual:
  - Open /admin/login, confirm no sidebar.
  - Log in, confirm sidebar appears and links work.
  - Confirm Imports flow and Publish workflow behave exactly as before.

Success criteria
- /admin/login renders and looks clean (no dead nav links).
- After login, /admin uses the new shell layout.
- Sidebar links work and do not 404.
- No behavior regressions in imports and publish workflows.

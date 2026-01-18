PR-UI-02: Tenant Homepage (Test List) with Tailwind + shadcn/ui

Read and follow AGENTS.md strictly.

Context
- PR-UI-01 sets up Tailwind and shadcn/ui primitives.
- The app already has tenant and locale resolution helpers (host based).
- Test content is being prepared, but we can already ship the tenant homepage and wire it to a test catalog.

Goal
- Replace the placeholder homepage with a tenant-aware page that lists available tests.
- Render the list using shadcn/ui components and Tailwind layout utilities.
- Keep the data source simple and file-based.

Workflow rules
- Create a new branch from main named: pr-ui-02-tenant-home
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.
- Run the project test gate locally before committing.

Task A: Test catalog data source
A1) Implement a minimal catalog loader used by UI pages.
- Add apps/web/src/lib/catalog/catalog.ts
- The loader must return a list of tests for a given tenant_id and locale.
- Each test item must include at minimum:
  - test_id
  - slug
  - title
  - short_description
  - estimated_minutes (integer)

A2) Use a repo file as the source of truth.
- If config/catalog.json already exists in the repo, use it.
- If it does not exist, create config/catalog.json with at least 1 sample test entry for the example tenant.
- Also create a minimal index file for test metadata, for example content/test_index.json, if no test metadata source exists yet.

A3) Validation
- The loader must throw a descriptive error if a tenant has a test_id that is missing from the metadata source.

Task B: Tenant homepage UI
B1) Update apps/web/src/app/page.tsx
Behavior
- Resolve tenant_id and locale from the incoming request.
- Load tests for the tenant via the catalog loader.
- Render a page with:
  - Header: tenant name or domain, and locale badge.
  - Main: a responsive grid of test cards.
  - Each card shows title, short_description, estimated_minutes, and a primary button linking to /t/<slug>.
  - Empty state: if no tests, show a neutral message and a link to docs/content/tests.md.

B2) Use shadcn/ui components
- Card, Button, Badge, Separator.

B3) Accessibility
- Buttons and links must be keyboard accessible.
- Ensure headings are in logical order.

Task C: Minimal metadata
C1) Add generateMetadata for the homepage.
- Title includes tenant.
- Description is a neutral site description.
- Canonical uses the request host.

Task D: Tests
D1) Add a small vitest test that validates the catalog loader behavior:
- happy path returns a non-empty list for the example tenant.
- missing test_id raises a descriptive error.

Success criteria
- scripts/ci.sh exits 0.
- Visiting / on a known tenant domain renders a list of test cards.
- Links navigate to /t/<slug>.

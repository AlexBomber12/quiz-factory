PR-PRODUCT-02: Tenant Homepage, Test Listing, and Test Landing Pages

Read and follow AGENTS.md strictly.

Context
- The repo already has tenant resolution (config/tenants.json) and analytics event endpoints.
- PR-PRODUCT-01 introduced content/tests and config/catalog.json.
- We need a real minimal UI so we can browse tenants and tests in a browser.

Goal
- Replace the placeholder homepage with a tenant-aware landing that lists available tests.
- Add a test landing page that loads localized copy from content.
- Keep UI minimal, mobile-first, and fast.

Workflow rules
- Create a new branch from main named: pr-product-02-tenant-ui
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.
- Run the project test gate locally before committing.

Task A: Tenant-aware homepage
A1) Replace apps/web/src/app/page.tsx with a tenant-aware homepage.
- Resolve tenant_id and locale using existing utilities.
- Load the tenant test list from config/catalog.json.
- Render a list of tests (title + short_description) as links to /t/<slug>.
- If tenant_id is unknown or has no tests, show an empty state with guidance.

Task B: Test landing page
B1) Add a new route:
- apps/web/src/app/t/[slug]/page.tsx

Behavior:
- Resolve tenant_id and locale.
- Map slug to test_id using the content registry.
- Load localized test content and render:
  - title
  - intro
  - estimated time (static for now)
  - a primary CTA button that links to /t/<slug>/run

B2) Add basic metadata
- Add generateMetadata for / and /t/[slug] with:
  - title and description from localized content
  - canonical based on request host

Task C: Minimal styling
- Keep styling simple.
- No component libraries.
- Ensure pages look acceptable on mobile.

Task D: Tests
- Add vitest tests that:
  - verify catalog to content mapping for the golden test
  - verify /t/[slug] loader resolves the expected test_id

Success criteria
- pnpm lint, pnpm typecheck, pnpm test, pnpm build all pass via scripts/ci.sh.
- Visiting / shows the tenant test list for known tenant domains.
- Visiting /t/<slug> renders the localized landing page for the golden test.

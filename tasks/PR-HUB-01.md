PR-HUB-01: Hub Tenant IA (Tests, Categories, Search, Trust Pages, Sitemap)

Read and follow AGENTS.md strictly.

Context
- The public site currently has a tenant homepage (/) and test landing (/t/[slug]).
- There is no hub-style navigation, category browsing, search, or trust pages.
- sitemap.ts currently lists only / and /t/<slug>.

Goal
- Add hub-style pages that make the tenant feel like a real tests portal.
- Keep pages tenant-aware and localized (use existing tenant + locale resolution).
- Extend sitemap to include the new hub pages.

Non-goals
- No new design system or block library changes.
- No new tracking events beyond existing page_view.
- No changes to checkout, scoring, or reports.

Workflow rules
- Create a new branch from main named: pr-hub-01-hub-ia
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.
- Run the project test gate locally before committing.

Task A: Public navigation shell
A1) Add a small shared public nav component used by hub pages.
- Location: apps/web/src/components/public/PublicNav.tsx (create folder if needed).
- Links:
  - Tests -> /tests
  - Categories -> /categories
  - About -> /about
- Keep it minimal and mobile-first.
- Use shadcn/ui primitives already in the repo (Button, Separator) or plain Tailwind.

Task B: Hub pages
B1) Add /tests
- Route: apps/web/src/app/tests/page.tsx
- Behavior:
  - Resolve tenant_id and locale.
  - Load tenant catalog using existing catalog utilities.
  - Support search via query param q (case-insensitive match on title and short_description).
  - Show each test as a card link to /t/<slug> with title, short_description, and estimated minutes.
  - If no tests match, show an empty state.

B2) Add /categories
- Route: apps/web/src/app/categories/page.tsx
- Behavior:
  - Resolve tenant_id and locale.
  - Derive a category list from published test specs (use loadPublishedTestBySlug per catalog entry).
  - Render categories as links to /c/<category-slug>.
  - Category slug rules:
    - lowercase
    - spaces and underscores -> hyphens
    - keep [a-z0-9-]

B3) Add /c/[category]
- Route: apps/web/src/app/c/[category]/page.tsx
- Behavior:
  - Resolve tenant_id and locale.
  - List tests whose category matches the decoded category slug.
  - Link each test to /t/<slug>.
  - Provide a back link to /categories.

Task C: Trust pages
C1) Add the following static routes:
- apps/web/src/app/about/page.tsx
- apps/web/src/app/privacy/page.tsx
- apps/web/src/app/terms/page.tsx
- apps/web/src/app/cookies/page.tsx
- apps/web/src/app/contact/page.tsx

Requirements
- Each page uses the PublicNav.
- Keep copy short and neutral. No medical claims.
- Provide a contact method that does not require a form (for now). For example: an email placeholder string.

Task D: Metadata + sitemap
D1) Metadata
- For each new route above, implement generateMetadata.
- Use existing helpers:
  - buildCanonical
  - buildTenantLabel
  - resolveTenantSeoContext
  - buildLocaleAlternatesForPath

D2) Extend sitemap
- Update apps/web/src/app/sitemap.ts to include:
  - /tests
  - /categories
  - /about
  - /privacy
  - /terms
  - /cookies
  - /contact
  - /c/<category-slug> for each category that exists for the tenant

Task E: Tests
E1) Add vitest tests:
- Category slugger produces stable output for representative categories.
- /categories derives at least 1 category for the golden test (when category exists).
- sitemap includes the static hub routes.

Success criteria
- scripts/ci.sh exits 0.
- /tests supports search with ?q= and shows an empty state when nothing matches.
- /categories and /c/[category] work for tenants with at least 1 published test.
- sitemap includes the new static hub pages and category pages.

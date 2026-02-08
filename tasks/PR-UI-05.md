PR-UI-05: Tenant Homepage Calm Premium Refresh (Search + Category Tags)

Read and follow AGENTS.md strictly.

Context
- The tenant homepage (apps/web/src/app/page.tsx) lists available tests but does not support search or tags.
- The codebase already supports categories via apps/web/src/lib/hub/categories.ts.
- PR-UI-04 introduces the Calm Premium token contract and Stitch layout references.

Goal
- Implement a homepage discovery experience with:
  - Search input
  - Category tag chips (multi-select)
  - Responsive grid of test cards
- Match the chosen Stitch variant from docs/ui/stitch/NOTES.md.
- Keep it mobile-first and fast.

Workflow rules
- Create a new branch from main named: pr-ui-05-tenant-home-search-tags
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.
- Run the project test gate locally before committing (scripts/ci.sh).

Task A: Ensure required primitives exist
A1) If apps/web/src/components/ui/input.tsx does not exist, add it using the standard shadcn/ui Input implementation.
- Keep it minimal and consistent with existing Button/Card/Badge primitives.
- Use cn helper from apps/web/src/lib/ui/cn.

Task B: Load tests with categories (server-side)
B1) Update apps/web/src/app/page.tsx to load category-aware tests.
- Prefer apps/web/src/lib/hub/categories.ts:
  - loadTenantHubTests(tenantId, locale) for tests with category/category_slug
  - deriveTenantCategories(tenantId, locale) for category chips
- Preserve existing niche homepage logic (featured_test_slugs) and apply it to the category-aware test list.
- The page must remain tenant-aware and localized as it is now.

Task C: Client-side filtering UI (search + tags)
C1) Create a client component to handle interactive filtering without full page reloads:
- Suggested path: apps/web/src/components/public/TenantTestExplorer.tsx
- Props (serializable):
  - tests: array of { test_id, slug, title, short_description, estimated_minutes, category, category_slug }
  - categories: array of { slug, label, test_count }
  - heading, subheading (strings)

C2) Behavior
- Search filters by title, short_description, and category label (case-insensitive).
- Tag chips are multi-select on category_slug.
- Selected tags apply as OR (show tests matching any selected category). If none selected, show all.
- Provide a Reset control that clears search and selected tags.
- Show empty state when nothing matches.

C3) Layout and components
- Implement the chosen Stitch layout from docs/ui/stitch/NOTES.md.
- Use shadcn/ui primitives (Card, Badge, Button, Input) and Tailwind utilities.
- Test cards:
  - Title
  - 1-line description
  - Meta badges (estimated minutes and category)
  - Primary CTA: Start test (Button) linking to /t/[slug]
  - No competing primary CTA per card

C4) Accessibility
- Search input has an aria-label.
- Chips and buttons are keyboard reachable and show ring focus.
- Empty state is clear and non-technical.

Task D: Verify no regressions
D1) Ensure existing hub pages (/tests, /categories, /c/[slug]) still work.
- Do not change routing or tenant resolution.

Tests and gates
- Run scripts/ci.sh and ensure exit code 0.
- Run pnpm --filter @quiz-factory/web build.

Success criteria
- Homepage has search + category tag chips and filters interactively.
- Layout matches the chosen Stitch variant.
- Calm Premium tokens are used (no hardcoded random colors).
- scripts/ci.sh exits 0.

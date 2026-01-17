PR-SEO-01: Sitemap, robots.txt, Canonicals, and Basic OG Metadata

Read and follow AGENTS.md strictly.

Context
- We will scale to many tenant domains.
- Each tenant has a list of tests from config/catalog.json.
- We need basic SEO hygiene: sitemap.xml, robots.txt, canonical URLs, and share cards.

Goal
- Generate tenant-specific sitemap.xml and robots.txt.
- Ensure homepage and test landing pages have correct canonical and localized metadata.
- Ensure non-content pages (run, preview, pay, report) are not indexed.

Workflow rules
- Create a new branch from main named: pr-seo-01-sitemap-robots
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.
- Run the project test gate locally before committing.

Task A: robots.txt and sitemap.xml
A1) Add Next metadata routes:
- apps/web/src/app/robots.ts
- apps/web/src/app/sitemap.ts

robots.ts requirements
- Allow indexing of content pages.
- Disallow indexing of:
  - /t/*/run
  - /t/*/preview
  - /t/*/pay
  - /report/*
  - /checkout/*

sitemap.ts requirements
- Generate URLs based on the current request host.
- Include:
  - /
  - /t/<slug> for each test in the tenant catalog
- Do not include run, preview, pay, report, checkout pages.

Task B: Canonical and metadata
B1) Add generateMetadata to:
- apps/web/src/app/page.tsx
- apps/web/src/app/t/[slug]/page.tsx

Requirements
- Title and description come from localized test content when applicable.
- Canonical uses https://<host> for production and matches request host for local.
- OpenGraph metadata is set (title, description, url).

Task C: OG image placeholder
C1) Add a simple static OG image placeholder:
- apps/web/public/og.png

C2) Use it in OpenGraph metadata.

Task D: Tests
D1) Add unit tests that:
- ensure sitemap generation includes expected test landing URLs
- ensure robots disallows the non-index routes

Success criteria
- scripts/ci.sh passes.
- /robots.txt and /sitemap.xml are accessible and correct per tenant.
- Canonicals and OG metadata render without runtime errors.

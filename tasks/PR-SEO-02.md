PR-SEO-02: SEO Scaling Enhancements (Lastmod, OG Images, Metadata Hygiene)

Read and follow AGENTS.md strictly.

Context
- Basic sitemap, robots.txt, canonicals, and OG metadata exist.
- We plan to scale to many tenants and many tests; SEO hygiene must be automated.

Goal
- Improve SEO outputs per tenant and per test without introducing external dependencies.

Scope
1) Sitemap improvements
- Ensure sitemap includes lastmod for each URL.
- lastmod should update when:
  - the test spec changes
  - the tenant catalog changes
- Keep it deterministic and fast.

2) Metadata hygiene
- Ensure every public page has:
  - canonical URL
  - title and description derived from content spec
  - language/locale tags
- Avoid duplicate titles across tests.

3) OG images
- Add dynamic OG image generation routes for:
  - test landing page
  - report page (generic, not user-specific)
- Use Next.js built-in OG image generation if available in this repo.
- Keep it fast and cacheable.

4) Social share instrumentation
- Make share buttons use the OG URLs and emit share_click (already in contract).

Constraints
- Do not add user-specific data into OG images.
- Do not add new third-party services.

Workflow rules
- Create a new branch from main named: pr-seo-02-scale
- Implement only what this task requests.
- Run the project test gate per AGENTS.md.

Definition of Done
- /sitemap.xml includes lastmod values.
- OG previews render for at least 1 test.
- Canonicals and meta tags are correct on home and /t/[slug].
- share_click is emitted by the share UI.
- Tests and lint pass and the PR is ready to merge.

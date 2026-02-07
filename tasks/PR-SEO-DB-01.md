PR-SEO-DB-01: Sitemap and Robots Read from DB (With Caching)

Read and follow AGENTS.md strictly.

Context
- sitemap.ts and robots.ts currently reflect filesystem catalog/specs.
- With DB content publishing, SEO endpoints must reflect the published state in tenant_tests.

Goal
- Update sitemap and robots generation so that:
  - in CONTENT_SOURCE=db, sitemap uses tenant_tests and published slugs
  - in CONTENT_SOURCE=fs, behavior stays unchanged
- Add lightweight caching to avoid DB hits on every request.

Non-goals
- Do not add new SEO features beyond correctness and caching.
- Do not modify test content formats.

Implementation requirements
- Cache policy:
  - per-tenant sitemap cache TTL 15 minutes
  - invalidate cache on publish/rollback by calling invalidateTenant(tenant_id)
- Ensure sitemap includes only enabled tests with a published_version_id.
- Keep canonical URLs consistent with current domain strategy.

Workflow rules
- Create a new branch from main named: pr-seo-db-01-sitemap
- Implement only what this task requests.

Definition of Done
- In DB mode, sitemap reflects published catalog from DB.
- In FS mode, sitemap remains unchanged.
- scripts/ci.sh --scope app passes.

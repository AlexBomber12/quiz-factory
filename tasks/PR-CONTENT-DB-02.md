PR-CONTENT-DB-02: Content Repository API, Caching, and Invalidation Hooks

Read and follow AGENTS.md strictly.

Context
- PR-CONTENT-DB-01 introduced Postgres schema and a DB connection for content.
- We need a typed repository layer for reading content and catalogs from DB.
- The public site still reads from filesystem for now; this PR only adds the DB read-path and cache utilities.

Goal
- Implement a DB-backed content repository module for apps/web:
  - getTenantCatalog(tenant_id)
  - getPublishedTestBySlug(tenant_id, slug, locale)
  - getTestById(test_id) and listVersions(test_id) for upcoming admin UI
- Add lightweight caching with explicit invalidation:
  - TTL cache in memory is acceptable for now
  - provide invalidateTenant(tenant_id) and invalidateTest(test_id)

Non-goals
- Do not update Next.js pages to use DB content yet.
- Do not implement admin UI or upload routes yet.
- Do not change filesystem loaders in this PR.

Implementation requirements
- Add module: apps/web/src/lib/content_db/repo.ts (or similar).
- Use parameterized SQL (no string concatenation).
- Cache policy:
  - tenant catalog cache TTL 60s
  - published test-by-slug cache TTL 60s
  - invalidation functions immediately drop relevant keys
- Provide minimal unit tests with vitest for the cache layer (pure functions).
  - DB integration tests are optional and may be skipped in CI.

Workflow rules
- Create a new branch from main named: pr-content-db-02-repo-cache
- Implement only what this task requests.

Definition of Done
- repo functions exist and compile in apps/web.
- cache keys are well-defined and invalidation works.
- No changes to existing FS content code paths.
- scripts/ci.sh --scope app passes.

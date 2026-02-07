PR-WEB-CONTENT-01: Public Site Loads Content from DB (Feature-flagged FS Fallback)

Read and follow AGENTS.md strictly.

Context
- Content currently loads from filesystem and config/catalog.json.
- Admin now publishes content into Postgres (tenant_tests + test_versions).
- We need the public site to read from DB, but retain a safe fallback to filesystem.

Goal
- Introduce CONTENT_SOURCE=fs|db (default fs) and update the public site to:
  - load tenant catalog from DB when CONTENT_SOURCE=db
  - load published specs from DB when CONTENT_SOURCE=db
  - otherwise use existing filesystem loaders unchanged
- Ensure the full product flow (landing, run, preview, pay, report) works in both modes.

Non-goals
- Do not remove filesystem content or config/catalog.json.
- Do not require a DB in CI by default.

Implementation requirements
- Add a provider module in apps/web/src/lib/content/provider.ts:
  - listCatalogForTenant(tenant_id)
  - loadPublishedTestBySlug(tenant_id, slug, locale)
  - implementation selects FS or DB based on process.env.CONTENT_SOURCE
- Update all pages and API routes that currently call FS loaders to call the provider.
- Caching:
  - in DB mode, use repo cache from PR-CONTENT-DB-02
  - in FS mode, keep existing caching behavior
- Add minimal smoke tests (vitest) for provider selection logic.

Workflow rules
- Create a new branch from main named: pr-web-content-01-db-provider
- Implement only what this task requests.

Definition of Done
- With CONTENT_SOURCE=fs, existing behavior is unchanged and CI passes.
- With CONTENT_SOURCE=db (local manual test), catalog and specs are read from DB.
- scripts/ci.sh --scope app passes.

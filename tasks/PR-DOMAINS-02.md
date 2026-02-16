PR-DOMAINS-02: Universal Domain Publications (Content Registry + Matrix)

Read and follow AGENTS.md strictly.

Context
- Admin is a control panel for domains. Domains publish content. Today the publication model is specialized for tests (tenant_tests).
- We need a universal publication layer so domains can publish any content type (tests today, products tomorrow).
- The admin already has a publications matrix for tenants x tests; we will generalize it without breaking existing behavior.

Goal
- Introduce a universal domain publication model in Content DB:
  - content_type + content_key (e.g., test:test-focus-rhythm, product:product-abc)
  - published_version_ref (for tests: test_versions.id; for products: product_versions.id)
  - enabled flag, published_at, updated_at
- Migrate existing test publications into the universal model.
- Keep a compatibility layer so existing code paths continue working, but new code should use the universal layer.

Non-goals
- Do not implement products content type in this PR.
- Do not change analytics pipelines or event contracts in this PR.

Implementation requirements
- DB schema and migration
  - Add tables:
    - content_items:
      - id uuid PRIMARY KEY
      - content_type text NOT NULL
      - content_key text NOT NULL
      - slug text NOT NULL
      - created_at, updated_at
      - UNIQUE(content_type, content_key)
      - UNIQUE(content_type, slug)
    - domain_publications:
      - id uuid PRIMARY KEY
      - tenant_id text NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE
      - content_item_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE
      - published_version_id uuid NULL
      - enabled boolean NOT NULL DEFAULT true
      - published_at timestamptz NULL
      - created_at, updated_at
      - UNIQUE(tenant_id, content_item_id)
  - Data migration:
    - backfill content_items for existing tests (from tests table)
    - backfill domain_publications from existing tenant_tests rows
  - Compatibility:
    - keep tenant_tests as a view over domain_publications for content_type=test, so existing queries can still work during transition
- Repository layer
  - Add repo functions:
    - upsertContentItem(content_type, content_key, slug)
    - listDomainPublications(tenant_id, optional filters)
    - publishDomainContent(tenant_id, content_type, content_key, published_version_id, enabled)
    - rollbackDomainContent(tenant_id, content_type, content_key, previous_version_id)
  - Update existing publish/rollback logic for tests to write to domain_publications (and not directly to tenant_tests)
- Admin UI
  - Extend /admin/publications:
    - show content_type column
    - filters: tenant, content_type
    - include export endpoint supports content_type filter
  - Extend /admin/tenants/[tenant_id]:
    - publications section shows both tests and future content types (even if only tests exist now)
  - Ensure existing UX for test publish/rollback remains intact
- API
  - Extend /api/admin/publications/export to include content_type and content_key
  - If needed, add /api/admin/publications (list) with filters for the UI
- Audit logging
  - log publish/rollback and enable/disable actions with content_type and content_key

Workflow rules
- Create a new branch from main named: pr-domains-02-publications-universal
- Implement only what this task requests.

Definition of Done
- Existing tests publishing continues to work.
- domain_publications contains rows for published tests.
- /admin/publications shows a matrix driven by domain_publications and supports filters.
- scripts/ci.sh --scope app passes.

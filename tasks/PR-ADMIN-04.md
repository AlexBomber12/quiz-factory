PR-ADMIN-04: Publish Workflow (Tenant Mapping) and One-click Rollback

Read and follow AGENTS.md strictly.

Context
- We will push content directly to production. Safety rails are required:
  - explicit publish step
  - per-tenant enable/disable
  - rollback by switching published_version_id
  - audit for every publish/rollback action

Goal
- Add admin UI and API to:
  - list tests and their versions
  - publish a selected draft version to 1+ tenants (update tenant_tests)
  - rollback a tenant to a previous version
  - enable/disable a test per tenant
- Ensure cache invalidation hooks from PR-CONTENT-DB-02 are called.

Non-goals
- Do not switch public site to DB in this PR.
- Do not add SEO changes in this PR.

Implementation requirements
- Tenants list source: config/tenants.json remains the registry (read-only).
- API routes under /api/admin:
  - POST /api/admin/publish with { test_id, version_id, tenant_ids, is_enabled }
  - POST /api/admin/rollback with { test_id, tenant_id, version_id }
- Data rules:
  - publishing sets tenant_tests.published_version_id and published_at/by
  - rollback is just a publish of an older version_id
  - never delete versions
- RBAC:
  - editor can create drafts
  - only admin can publish/rollback
- Audit:
  - write admin_audit_events for publish and rollback with tenant ids and version id.

Workflow rules
- Create a new branch from main named: pr-admin-04-publish-rollback
- Implement only what this task requests.

Definition of Done
- Admin can publish a draft version to a tenant and then rollback to a previous version.
- tenant_tests accurately reflects current published version per tenant.
- Audit events are written for publish and rollback.
- Cache invalidation is triggered after publish/rollback.
- scripts/ci.sh --scope app passes.

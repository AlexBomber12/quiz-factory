PR-MIGRATION-01: One-time Migration from Filesystem Content to DB (Idempotent)

Read and follow AGENTS.md strictly.

Context
- We already have filesystem content in content/tests and config/catalog.json.
- We need a one-time migration to seed DB with existing published tests and catalogs.

Goal
- Add a migration script that imports:
  - tests and a version row for each existing content/tests/*/spec.json
  - tenant_tests published_version_id according to config/catalog.json
- The script must be idempotent and safe to re-run.

Non-goals
- Do not delete or modify filesystem content in this PR.
- Do not change admin UI in this PR.

Implementation requirements
- Implement a Node script under apps/web/scripts (plain JS/TS that can run with node):
  - reads content/tests/*/spec.json
  - reads config/catalog.json
  - inserts into tests/test_versions/tenant_tests using parameterized SQL
  - uses checksum to avoid duplicate versions
  - logs a concise summary (counts and any skipped items)
- Add a command to docs/content_db.md:
  - how to run migration locally
  - how to verify counts

Workflow rules
- Create a new branch from main named: pr-migration-01-fs-to-db
- Implement only what this task requests.

Definition of Done
- Running the script seeds DB with tests and published tenant mappings.
- Re-running does not create duplicates.
- scripts/ci.sh --scope app passes.

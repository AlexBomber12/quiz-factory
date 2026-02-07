PR-CONTENT-DB-01: Content DB Schema, Migrations, Local Dev Bootstrap

Read and follow AGENTS.md strictly.

Context
- Today, test content and the tenant catalog are loaded from the filesystem:
  - content/tests/*/spec.json
  - config/catalog.json
- We want instant publishing from WebUI, so content must live in a database (and optional storage), not in git.
- This PR is database-only scaffolding. Do not switch the public site to DB yet.

Goal
- Add a Postgres-backed content database layer with:
  - schema for tests, test_versions, tenant_tests, imports
  - a minimal migration mechanism and local dev bootstrap
  - a single DB connection module for apps/web

Non-goals
- Do not modify existing filesystem content loaders in this PR.
- Do not add admin UI or upload routes in this PR.
- Do not remove or change config/catalog.json or content/tests.

Implementation requirements
- Database: Postgres.
- apps/web will use an env var CONTENT_DATABASE_URL for DB access.
- Add a minimal migration runner that can be executed locally and in CI.
  - Prefer a simple SQL-migrations approach (ordered files) with an applied_migrations table.
  - Do not introduce heavyweight ORMs unless strictly required.
- Add a docker-compose file for local dev Postgres under infra/content-db/docker-compose.yml.
- Add docs:
  - docs/content_db.md describing local setup, migration commands, and required env vars.
- Update .env.example with the new non-secret env var names (no real URLs).

Schema (minimum)
- tests
  - id (uuid pk)
  - test_id (unique, stable id like "test-...")
  - slug (unique)
  - default_locale
  - created_at, updated_at
- test_versions
  - id (uuid pk)
  - test_id (fk -> tests.id)
  - version (int, increasing per test)
  - status ("draft" | "archived") in this PR (published is controlled by tenant_tests)
  - spec_json (jsonb)
  - source_import_id (nullable fk -> imports.id)
  - checksum (sha256 of canonical spec_json)
  - created_at, created_by (string, nullable for now)
- tenant_tests
  - tenant_id (string)
  - test_id (fk -> tests.id)
  - published_version_id (fk -> test_versions.id, nullable)
  - is_enabled (bool)
  - published_at, published_by
  - unique (tenant_id, test_id)
- imports
  - id (uuid pk)
  - status ("uploaded" | "processed" | "failed")
  - files_json (jsonb; locale -> { filename, md, sha256 })
  - detected_meta (jsonb; optional)
  - error (text)
  - created_at, created_by

Workflow rules
- Create a new branch from main named: pr-content-db-01-schema-migrations
- Implement only what this task requests.

Definition of Done
- infra/content-db/docker-compose.yml exists and can start Postgres locally.
- apps/web has a DB module (pg Pool) gated by CONTENT_DATABASE_URL.
- Migration runner exists and can bring an empty DB to the latest schema.
- docs/content_db.md exists with step-by-step local setup.
- .env.example includes CONTENT_DATABASE_URL (empty value).
- scripts/ci.sh --scope app passes (do not require a running DB for app CI yet).

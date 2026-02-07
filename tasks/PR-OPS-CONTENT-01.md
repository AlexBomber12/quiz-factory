PR-OPS-CONTENT-01: Content DB Backup/Restore Runbook and Scripts

Read and follow AGENTS.md strictly.

Context
- Content is now mutable and lives in Postgres.
- We need operational safety: backups, restore procedure, and basic monitoring guidance.

Goal
- Add backup and restore scripts plus runbook documentation:
  - scripts/ops/content_db_backup.sh
  - scripts/ops/content_db_restore.sh
  - docs/ops/content_db_backup_restore.md

Non-goals
- Do not add complex infrastructure automation in this PR.
- Do not change app runtime code except minimal references in docs.

Implementation requirements
- Scripts must:
  - accept CONTENT_DATABASE_URL
  - create timestamped backups under a local directory (configurable)
  - restore from a specified backup file
  - avoid printing credentials in logs
- Runbook must include:
  - when to run backups
  - how to restore
  - how to verify restore (simple SQL checks)
  - suggested retention policy (N days)

Workflow rules
- Create a new branch from main named: pr-ops-content-01-backups
- Implement only what this task requests.

Definition of Done
- Backup and restore scripts exist, are executable, and are documented.
- scripts/ci.sh --scope app passes.

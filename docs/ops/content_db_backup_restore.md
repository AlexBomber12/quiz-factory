# Content DB Backup and Restore

## Purpose
Keep the content PostgreSQL database recoverable after operator error, bad deploys, or infrastructure incidents.

## Preconditions
- `CONTENT_DATABASE_URL` points to the target content database.
- Operator host has PostgreSQL client tools installed:
  - `pg_dump`
  - `pg_restore`
  - `psql` (for verification checks)
- Backups are written to local disk by default under `./backups/content-db`.

## When to run backups
- Daily automated backup (recommended baseline).
- Before:
  - running migrations,
  - bulk content imports,
  - publish/rollback operations during incidents.
- After major content changes if you need tighter recovery point objectives.

## Backup command
```bash
CONTENT_DATABASE_URL='postgres://user:***@host:5432/dbname' \
scripts/ops/content_db_backup.sh --backup-dir ./backups/content-db
```

Dry run:
```bash
CONTENT_DATABASE_URL='postgres://user:***@host:5432/dbname' \
scripts/ops/content_db_backup.sh --dry-run
```

Result:
- Script creates a timestamped dump file:
  - `./backups/content-db/content-db-YYYYMMDDTHHMMSSZ.dump`
- Credentials are never printed by the script logs.

## Restore command
Choose the backup file to restore:
```bash
ls -1 ./backups/content-db/*.dump
```

Run restore:
```bash
CONTENT_DATABASE_URL='postgres://user:***@host:5432/dbname' \
scripts/ops/content_db_restore.sh --backup-file ./backups/content-db/content-db-YYYYMMDDTHHMMSSZ.dump
```

Dry run:
```bash
CONTENT_DATABASE_URL='postgres://user:***@host:5432/dbname' \
scripts/ops/content_db_restore.sh --backup-file ./backups/content-db/content-db-YYYYMMDDTHHMMSSZ.dump --dry-run
```

Notes:
- Restore runs `pg_restore --clean --if-exists`, so existing objects are replaced.
- Restore against the correct environment database (staging vs production) before running.

## Post-restore verification
Run simple row-count checks:

```bash
psql "$CONTENT_DATABASE_URL" -c "SELECT COUNT(*) AS imports FROM imports;"
psql "$CONTENT_DATABASE_URL" -c "SELECT COUNT(*) AS tests FROM tests;"
psql "$CONTENT_DATABASE_URL" -c "SELECT COUNT(*) AS test_versions FROM test_versions;"
psql "$CONTENT_DATABASE_URL" -c "SELECT COUNT(*) AS tenant_tests FROM tenant_tests;"
psql "$CONTENT_DATABASE_URL" -c "SELECT COUNT(*) AS admin_audit_events FROM admin_audit_events;"
```

Sanity-check latest published mappings:

```bash
psql "$CONTENT_DATABASE_URL" -c "SELECT tenant_id, COUNT(*) AS enabled_tests FROM tenant_tests WHERE is_enabled = true GROUP BY tenant_id ORDER BY tenant_id;"
```

If counts look wrong, stop publishes and restore the previous known-good dump.

## Suggested retention policy
- Keep daily backups for **30 days** minimum.
- Keep weekly backups for **12 weeks** (optional but recommended).
- Store at least one copy off-host (object storage or separate disk).

Example local pruning for backups older than 30 days:

```bash
find ./backups/content-db -type f -name 'content-db-*.dump' -mtime +30 -delete
```

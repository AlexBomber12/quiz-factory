# PostHog Operations Runbook

## Purpose
Keep PostHog reliable, secure, and recoverable in production.

## Recommended architecture
- Run PostHog behind a reverse proxy or load balancer that terminates TLS.
- Keep Postgres, ClickHouse, and Redis on a private network segment.
- Use durable volumes for Postgres, ClickHouse, and PostHog uploads.
- Monitor container healthchecks, storage usage, and CPU and memory.
- Schedule backups to local disk and an optional remote target.

## Secure admin access
- Restrict admin and settings access to a VPN, allowlist, or identity proxy.
- Enforce SSO or MFA for all admin users.
- Use least privilege accounts and remove unused admins promptly.
- Store secrets in a secret manager, not in the repo or a committed .env.

## Configuration and secrets
- Ensure these values are set securely in the runtime environment:
  - PostHog: SECRET_KEY, SITE_URL
  - Postgres: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
  - ClickHouse: CLICKHOUSE_HOST, CLICKHOUSE_DATABASE, CLICKHOUSE_USER, CLICKHOUSE_PASSWORD
  - Redis: REDIS_URL
- In production, avoid DISABLE_SECURE_SSL_REDIRECT or set it to false.

## Update procedure
1) Review PostHog release notes and confirm required migrations.
2) Run a backup using `scripts/ops/posthog_backup.sh`.
3) Update pinned image tags in `infra/posthog/docker-compose.yml`.
4) Pull and roll services:
   - `docker compose -f infra/posthog/docker-compose.yml pull`
   - `docker compose -f infra/posthog/docker-compose.yml up -d`
5) Verify container healthchecks and log in to PostHog.

## Backup and restore
- Tools required on the operator host:
  - `pg_dump`, `pg_restore`, `clickhouse-client`, `gzip`
  - `rsync` for remote copy, or `aws` for S3 targets
- Local backup directory and remote target:
  - `BACKUP_DIR` sets the local backup root (default `./backups/posthog`).
  - `REMOTE_TARGET` optionally syncs backups to a remote path or `s3://` URI.
- Connection variables and defaults:
  - Postgres: `POSTHOG_PG_HOST` (localhost), `POSTHOG_PG_PORT` (5432),
    `POSTHOG_PG_USER` (posthog), `POSTHOG_PG_DB` (posthog), `POSTHOG_PG_PASSWORD`.
  - ClickHouse: `POSTHOG_CH_HOST` (localhost), `POSTHOG_CH_PORT` (9000),
    `POSTHOG_CH_USER` (default), `POSTHOG_CH_DB` (posthog), `POSTHOG_CH_PASSWORD`.
- Dry run examples:
  - `scripts/ops/posthog_backup.sh --dry-run`
  - `scripts/ops/posthog_restore.sh --dry-run --backup-dir /path/to/backup`
- Restore expectations:
  - Restore into an empty Postgres database and empty ClickHouse database.
  - For existing data, drop tables or databases before restore.

## Incident checklist
### PostHog down
- Check container status:
  - `docker compose -f infra/posthog/docker-compose.yml ps`
- Review PostHog logs:
  - `docker compose -f infra/posthog/docker-compose.yml logs --tail 200 posthog`
- Confirm Postgres, ClickHouse, and Redis are healthy.
- Check disk space and memory on the host.
- Restart services if needed:
  - `docker compose -f infra/posthog/docker-compose.yml restart`

### ClickHouse issues
- Check ClickHouse logs:
  - `docker compose -f infra/posthog/docker-compose.yml logs --tail 200 clickhouse`
- Validate disk usage and free space on the host.
- If ClickHouse is read only due to disk, free space and restart.
- If data is corrupted, restore from the last good backup.

## Privacy verification
- In PostHog, open Settings and confirm these are enabled:
  - Discard client IP addresses.
  - Disable GeoIP.
- Open a recent event and confirm `$geoip_disable` is true.
- Confirm the event IP field is empty in the UI.

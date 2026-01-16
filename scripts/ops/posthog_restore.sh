#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/ops/posthog_restore.sh --backup-dir DIR [--dry-run]

Restores PostHog Postgres and ClickHouse data from a backup directory.

Options:
  --backup-dir DIR  Path to a backup directory created by posthog_backup.sh.
  --dry-run         Print actions without restoring data.
USAGE
}

log() {
  printf '%s\n' "$*"
}

die() {
  log "Error: $*"
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

DRY_RUN=0
BACKUP_DIR="${BACKUP_DIR:-}"

PG_HOST="${POSTHOG_PG_HOST:-localhost}"
PG_PORT="${POSTHOG_PG_PORT:-5432}"
PG_USER="${POSTHOG_PG_USER:-posthog}"
PG_DB="${POSTHOG_PG_DB:-posthog}"
PG_PASSWORD="${POSTHOG_PG_PASSWORD:-}"

CH_HOST="${POSTHOG_CH_HOST:-localhost}"
CH_PORT="${POSTHOG_CH_PORT:-9000}"
CH_USER="${POSTHOG_CH_USER:-default}"
CH_DB="${POSTHOG_CH_DB:-posthog}"
CH_PASSWORD="${POSTHOG_CH_PASSWORD:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backup-dir)
      BACKUP_DIR="$2"
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage
      die "Unknown argument: $1"
      ;;
  esac
  shift
done

if [[ -z "$BACKUP_DIR" ]]; then
  usage
  die "--backup-dir is required"
fi

pg_dump_file="$BACKUP_DIR/postgres/postgres.dump"
ch_schema_file="$BACKUP_DIR/clickhouse/schema.sql"
ch_tables_dir="$BACKUP_DIR/clickhouse/tables"

log "Starting PostHog restore"
log "Backup source: $BACKUP_DIR"
if [[ "$DRY_RUN" -eq 1 ]]; then
  log "Dry run mode enabled"
fi

if [[ "$DRY_RUN" -eq 0 ]]; then
  require_cmd pg_restore
  require_cmd clickhouse-client
  require_cmd gzip
fi

if [[ ! -f "$pg_dump_file" ]]; then
  die "Postgres backup file not found: $pg_dump_file"
fi

if [[ ! -f "$ch_schema_file" ]]; then
  die "ClickHouse schema file not found: $ch_schema_file"
fi

if [[ ! -d "$ch_tables_dir" ]]; then
  die "ClickHouse tables directory not found: $ch_tables_dir"
fi

log "Restoring Postgres database $PG_DB"
if [[ "$DRY_RUN" -eq 1 ]]; then
  log "Would run pg_restore from $pg_dump_file"
else
  pg_env=()
  if [[ -n "$PG_PASSWORD" ]]; then
    pg_env=(env PGPASSWORD="$PG_PASSWORD")
  fi
  "${pg_env[@]}" pg_restore \
    --host "$PG_HOST" \
    --port "$PG_PORT" \
    --username "$PG_USER" \
    --dbname "$PG_DB" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    "$pg_dump_file"
fi

log "Restoring ClickHouse database $CH_DB"
if [[ "$DRY_RUN" -eq 1 ]]; then
  log "Would apply schema from $ch_schema_file"
  log "Would load tables from $ch_tables_dir"
else
  ch_env=()
  if [[ -n "$CH_PASSWORD" ]]; then
    ch_env=(env CLICKHOUSE_PASSWORD="$CH_PASSWORD")
  fi

  "${ch_env[@]}" clickhouse-client \
    --host "$CH_HOST" \
    --port "$CH_PORT" \
    --user "$CH_USER" \
    --multiquery < "$ch_schema_file"

  shopt -s nullglob
  table_files=("$ch_tables_dir"/*.native.gz)
  shopt -u nullglob

  if [[ ${#table_files[@]} -eq 0 ]]; then
    log "No ClickHouse table dumps found, skipping data restore"
  else
    for table_file in "${table_files[@]}"; do
      table_name="$(basename "$table_file" .native.gz)"
      gzip -dc "$table_file" | "${ch_env[@]}" clickhouse-client \
        --host "$CH_HOST" \
        --port "$CH_PORT" \
        --user "$CH_USER" \
        --query "INSERT INTO $CH_DB.$table_name FORMAT Native"
    done
  fi
fi

log "Restore complete"

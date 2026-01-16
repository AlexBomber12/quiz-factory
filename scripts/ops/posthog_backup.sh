#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/ops/posthog_backup.sh [--dry-run] [--backup-dir DIR] [--remote TARGET]

Backs up PostHog Postgres and ClickHouse data to a timestamped directory.

Options:
  --dry-run         Print actions without writing data.
  --backup-dir DIR  Override BACKUP_DIR for the local backup root.
  --remote TARGET   Sync the backup to a remote target (rsync path or s3:// URI).
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
BACKUP_DIR="${BACKUP_DIR:-./backups/posthog}"
REMOTE_TARGET="${REMOTE_TARGET:-}"

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
    --dry-run)
      DRY_RUN=1
      ;;
    --backup-dir)
      BACKUP_DIR="$2"
      shift
      ;;
    --remote)
      REMOTE_TARGET="$2"
      shift
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
  die "BACKUP_DIR is empty"
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_root="${BACKUP_DIR%/}/$timestamp"
pg_dir="$backup_root/postgres"
ch_dir="$backup_root/clickhouse"
ch_tables_dir="$ch_dir/tables"

log "Starting PostHog backup"
log "Backup root: $backup_root"
if [[ "$DRY_RUN" -eq 1 ]]; then
  log "Dry run mode enabled"
fi

if [[ "$DRY_RUN" -eq 0 ]]; then
  require_cmd pg_dump
  require_cmd clickhouse-client
  require_cmd gzip
  if [[ -n "$REMOTE_TARGET" ]]; then
    if [[ "$REMOTE_TARGET" == s3://* ]]; then
      require_cmd aws
    else
      require_cmd rsync
    fi
  fi
  mkdir -p "$pg_dir" "$ch_tables_dir"
else
  if [[ -n "$REMOTE_TARGET" ]]; then
    if [[ "$REMOTE_TARGET" == s3://* ]]; then
      require_cmd aws
    else
      require_cmd rsync
    fi
  fi
fi

log "Backing up Postgres database $PG_DB"
if [[ "$DRY_RUN" -eq 1 ]]; then
  log "Would run pg_dump to $pg_dir/postgres.dump"
else
  pg_env=()
  if [[ -n "$PG_PASSWORD" ]]; then
    pg_env=(env PGPASSWORD="$PG_PASSWORD")
  fi
  "${pg_env[@]}" pg_dump \
    --host "$PG_HOST" \
    --port "$PG_PORT" \
    --username "$PG_USER" \
    --format=custom \
    --file "$pg_dir/postgres.dump" \
    "$PG_DB"
fi

log "Backing up ClickHouse database $CH_DB"
if [[ "$DRY_RUN" -eq 1 ]]; then
  log "Would export schema and tables to $ch_dir"
else
  ch_env=()
  if [[ -n "$CH_PASSWORD" ]]; then
    ch_env=(env CLICKHOUSE_PASSWORD="$CH_PASSWORD")
  fi

  schema_file="$ch_dir/schema.sql"
  printf 'CREATE DATABASE IF NOT EXISTS %s;\n\n' "$CH_DB" > "$schema_file"

  tables="$("${ch_env[@]}" clickhouse-client \
    --host "$CH_HOST" \
    --port "$CH_PORT" \
    --user "$CH_USER" \
    --database "$CH_DB" \
    --query "SHOW TABLES")"

  if [[ -z "$tables" ]]; then
    log "No ClickHouse tables found"
  else
    while IFS= read -r table; do
      [[ -z "$table" ]] && continue
      "${ch_env[@]}" clickhouse-client \
        --host "$CH_HOST" \
        --port "$CH_PORT" \
        --user "$CH_USER" \
        --database "$CH_DB" \
        --query "SHOW CREATE TABLE $table" >> "$schema_file"
      printf ';\n\n' >> "$schema_file"

      "${ch_env[@]}" clickhouse-client \
        --host "$CH_HOST" \
        --port "$CH_PORT" \
        --user "$CH_USER" \
        --database "$CH_DB" \
        --query "SELECT * FROM $table FORMAT Native" | gzip -c > "$ch_tables_dir/$table.native.gz"
    done <<< "$tables"
  fi
fi

if [[ -n "$REMOTE_TARGET" ]]; then
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "Would sync $backup_root to $REMOTE_TARGET"
  else
    if [[ "$REMOTE_TARGET" == s3://* ]]; then
      aws s3 sync "$backup_root" "$REMOTE_TARGET/$timestamp"
    else
      rsync -a "$backup_root/" "$REMOTE_TARGET/$timestamp/"
    fi
  fi
fi

log "Backup complete"

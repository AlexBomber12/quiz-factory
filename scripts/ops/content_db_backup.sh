#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/ops/content_db_backup.sh [--backup-dir DIR] [--dry-run]

Create a timestamped PostgreSQL backup for the content database.

Required environment:
  CONTENT_DATABASE_URL   PostgreSQL connection string for the content DB.

Options:
  --backup-dir DIR       Override BACKUP_DIR (default: ./backups/content-db).
  --dry-run              Print the planned backup path without running pg_dump.
  -h, --help             Show this help message.
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
BACKUP_DIR="${BACKUP_DIR:-./backups/content-db}"
CONTENT_DATABASE_URL="${CONTENT_DATABASE_URL:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backup-dir)
      [[ $# -ge 2 ]] || die "Missing value for --backup-dir"
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

if [[ -z "$CONTENT_DATABASE_URL" ]]; then
  die "CONTENT_DATABASE_URL is required"
fi

if [[ -z "$BACKUP_DIR" ]]; then
  die "Backup directory cannot be empty"
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_root="${BACKUP_DIR%/}"
backup_file="${backup_root}/content-db-${timestamp}.dump"

log "Starting content DB backup"
log "Backup file: $backup_file"

if [[ "$DRY_RUN" -eq 1 ]]; then
  log "Dry run mode enabled"
  log "Would run pg_dump and write a custom-format dump file"
  exit 0
fi

require_cmd pg_dump
mkdir -p "$backup_root"
umask 077

pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file "$backup_file" \
  "$CONTENT_DATABASE_URL"

if [[ ! -s "$backup_file" ]]; then
  die "Backup did not produce a non-empty file: $backup_file"
fi

log "Backup complete: $backup_file"

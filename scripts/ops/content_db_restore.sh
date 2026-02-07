#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/ops/content_db_restore.sh --backup-file FILE [--dry-run]

Restore the content database from a backup created by content_db_backup.sh.

Required environment:
  CONTENT_DATABASE_URL   PostgreSQL connection string for the content DB.

Options:
  --backup-file FILE     Path to a .dump backup file.
  --dry-run              Print planned restore actions without changing data.
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
BACKUP_FILE="${BACKUP_FILE:-}"
CONTENT_DATABASE_URL="${CONTENT_DATABASE_URL:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backup-file)
      [[ $# -ge 2 ]] || die "Missing value for --backup-file"
      BACKUP_FILE="$2"
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

if [[ -z "$BACKUP_FILE" ]]; then
  usage
  die "--backup-file is required"
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  die "Backup file not found: $BACKUP_FILE"
fi

log "Starting content DB restore"
log "Backup source: $BACKUP_FILE"

if [[ "$DRY_RUN" -eq 1 ]]; then
  log "Dry run mode enabled"
  log "Would run pg_restore with --clean --if-exists"
  exit 0
fi

require_cmd pg_restore

pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname "$CONTENT_DATABASE_URL" \
  "$BACKUP_FILE"

log "Restore complete"

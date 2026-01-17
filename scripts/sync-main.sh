#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: scripts/sync-main.sh must be run inside a git repository." >&2
  exit 1
}
cd "$repo_root"

current_branch="$(git rev-parse --abbrev-ref HEAD)"

if [[ "$current_branch" == "main" ]]; then
  git pull --ff-only origin main
else
  git fetch origin main:main --prune
fi

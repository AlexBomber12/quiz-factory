#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: scripts/run-planned-batch.sh must be run inside a git repository." >&2
  exit 1
}
cd "$repo_root"

usage() {
  cat <<'USAGE'
Usage: scripts/run-planned-batch.sh <COUNT>
USAGE
}

die() {
  echo "ERROR: $*" >&2
  exit 1
}

count="${1:-}"
if [[ -z "$count" ]]; then
  usage
  exit 2
fi

if ! [[ "$count" =~ ^[0-9]+$ ]]; then
  die "COUNT must be a positive integer."
fi

if (( count < 1 )); then
  die "COUNT must be at least 1."
fi

if ! command -v codex >/dev/null 2>&1; then
  die "codex CLI is required. Install or ensure it is on PATH."
fi

if ! command -v gh >/dev/null 2>&1; then
  die "gh is required. Install GitHub CLI from https://cli.github.com/"
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for (( i=1; i<=count; i++ )); do
  echo "Starting planned PR ${i}/${count}..."
  codex exec --full-auto "Run PLANNED PR"

  current_branch="$(git rev-parse --abbrev-ref HEAD)"
  pr_number=""

  if ! pr_number="$(gh pr view --json number -q .number 2>/dev/null)"; then
    pr_number=""
  fi

  if [[ -z "$pr_number" || "$pr_number" == "null" ]]; then
    if ! pr_number="$(gh pr list --head "$current_branch" --json number -q '.[0].number' 2>/dev/null)"; then
      pr_number=""
    fi
  fi

  if [[ -z "$pr_number" || "$pr_number" == "null" ]]; then
    die "Unable to determine PR number for branch ${current_branch}."
  fi

  "${script_dir}/pr-autopilot.sh" "$pr_number"
done

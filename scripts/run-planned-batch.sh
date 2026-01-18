#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: scripts/run-planned-batch.sh must be run inside a git repository." >&2
  exit 1
}
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$repo_root"

usage() {
  cat <<'USAGE'
Usage: scripts/run-planned-batch.sh <COUNT|ALL>
USAGE
}

die() {
  echo "ERROR: $*" >&2
  exit 1
}

count_arg="${1:-}"
if [[ -z "$count_arg" ]]; then
  usage
  exit 2
fi

mode="count"
if [[ "${count_arg^^}" == "ALL" ]]; then
  mode="all"
else
  if ! [[ "$count_arg" =~ ^[0-9]+$ ]]; then
    die "COUNT must be a positive integer."
  fi
  if (( count_arg < 1 )); then
    die "COUNT must be at least 1."
  fi
  count="$count_arg"
fi

if ! command -v codex >/dev/null 2>&1; then
  die "codex CLI is required. Install or ensure it is on PATH."
fi

if ! command -v gh >/dev/null 2>&1; then
  die "gh is required. Install GitHub CLI from https://cli.github.com/"
fi

queue_file="$repo_root/tasks/QUEUE.md"
if [[ "$mode" == "all" ]]; then
  if [[ ! -f "$queue_file" ]]; then
    echo "ERROR: queue file not found at ${queue_file}." >&2
    exit 2
  fi
fi

run_planned_pr() {
  local label="$1"
  echo "Starting planned PR ${label}..."
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
}

queue_has_work() {
  grep -Eq 'Status:[[:space:]]*(TODO|DOING)\b' "$queue_file"
}

if [[ "$mode" == "all" ]]; then
  max_pr="${RUN_PLANNED_MAX_PR:-50}"
  if ! [[ "$max_pr" =~ ^[0-9]+$ ]]; then
    die "RUN_PLANNED_MAX_PR must be a positive integer."
  fi
  if (( max_pr < 1 )); then
    die "RUN_PLANNED_MAX_PR must be at least 1."
  fi

  echo "ALL mode: starting"
  iteration=0
  while queue_has_work; do
    ((++iteration))
    echo "ALL mode: iteration ${iteration}"
    if (( iteration > max_pr )); then
      echo "ERROR: RUN_PLANNED_MAX_PR (${max_pr}) exceeded while processing ALL mode." >&2
      exit 2
    fi
    run_planned_pr "${iteration} (ALL mode)"
  done
  echo "ALL mode: queue empty, done"
  exit 0
else
  for (( i=1; i<=count; i++ )); do
    run_planned_pr "${i}/${count}"
  done
fi

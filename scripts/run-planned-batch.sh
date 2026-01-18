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

ensure_clean_tree() {
  [[ -z "$(git status --porcelain)" ]] && return 0
  echo "Dirty working tree detected; creating WIP checkpoint."
  git add -A
  set +e
  git commit -m "WIP: autopilot checkpoint"; local commit_status=$?
  set -e
  if [[ $commit_status -eq 0 || -z "$(git status --porcelain)" ]]; then
    return 0
  fi
  echo "ERROR: Unable to create WIP checkpoint." >&2
  return $commit_status
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
  local retries="${RUN_PLANNED_CI_RETRY:-2}" max_attempts attempt current_branch pr_number need_retry
  if ! [[ "$retries" =~ ^[0-9]+$ ]]; then
    die "RUN_PLANNED_CI_RETRY must be a non-negative integer."
  fi
  max_attempts=$(( retries + 1 )); attempt=0

  while (( attempt < max_attempts )); do
    attempt=$(( attempt + 1 ))
    echo "Starting planned PR ${label} (attempt ${attempt}/${max_attempts})..."
    ensure_clean_tree; need_retry=0
    if ! codex exec --full-auto "Run PLANNED PR"; then
      echo "Codex run failed for ${label}."
      ensure_clean_tree
      need_retry=1
    else
      ensure_clean_tree
      current_branch="$(git rev-parse --abbrev-ref HEAD)"
      pr_number="$(gh pr view --json number -q .number 2>/dev/null || true)"
      if [[ -z "$pr_number" || "$pr_number" == "null" ]]; then
        pr_number="$(gh pr list --head "$current_branch" --json number -q '.[0].number' 2>/dev/null || true)"
      fi
      if [[ -z "$pr_number" || "$pr_number" == "null" ]]; then
        echo "Unable to determine PR number for branch ${current_branch}."
        need_retry=1
      elif ! "${script_dir}/pr-autopilot.sh" "$pr_number"; then
        echo "PR autopilot failed for ${pr_number}."
        ensure_clean_tree
        need_retry=1
      else
        return 0
      fi
    fi
    if (( need_retry && attempt >= max_attempts )); then
      die "RUN_PLANNED_CI_RETRY (${retries}) exceeded; stopping."
    fi
  done
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

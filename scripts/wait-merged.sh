#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/wait-merged.sh <PR_NUMBER_OR_URL>
USAGE
}

die() {
  echo "ERROR: $*" >&2
  exit 1
}

require_gh() {
  if ! command -v gh >/dev/null 2>&1; then
    die "gh is required. Install GitHub CLI from https://cli.github.com/"
  fi
}

require_jq() {
  if ! command -v jq >/dev/null 2>&1; then
    cat <<'MSG' >&2
ERROR: jq is required but not installed.
Install:
  macOS: brew install jq
  Ubuntu/Debian: sudo apt-get install jq
MSG
    exit 1
  fi
}

pr_ref="${1:-}"
if [[ -z "$pr_ref" ]]; then
  usage
  exit 2
fi

require_gh
require_jq

if ! read -r pr_number pr_url < <(gh pr view "$pr_ref" --json number,url -q '"\(.number) \(.url)"' 2>/dev/null); then
  echo "ERROR: Unable to resolve PR: $pr_ref" >&2
  exit 2
fi

repo=""
if [[ "$pr_url" =~ github.com/([^/]+)/([^/]+)/pull/ ]]; then
  repo="${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"
fi

if [[ -z "$repo" ]]; then
  echo "ERROR: Unable to resolve repository." >&2
  exit 2
fi

timeout_sec="${MERGE_TIMEOUT_SEC:-3600}"
poll_sec="${MERGE_POLL_SEC:-20}"
start_ts="$(date +%s)"

while true; do
  if ! response="$(gh api "repos/${repo}/pulls/${pr_number}")"; then
    echo "ERROR: Unable to fetch PR #${pr_number} from ${repo}" >&2
    exit 2
  fi

  merged_at="$(jq -r '.merged_at // empty' <<<"$response")"
  state="$(jq -r '.state // empty' <<<"$response")"

  if [[ -n "$merged_at" && "$merged_at" != "null" ]]; then
    echo "PR #${pr_number} merged at ${merged_at}"
    exit 0
  fi

  if [[ "$state" == "closed" ]]; then
    echo "ERROR: PR #${pr_number} closed without merge" >&2
    exit 1
  fi

  now_ts="$(date +%s)"
  if (( now_ts - start_ts >= timeout_sec )); then
    echo "ERROR: Timed out waiting for PR #${pr_number} to merge after ${timeout_sec}s" >&2
    exit 2
  fi

  sleep "$poll_sec"
done

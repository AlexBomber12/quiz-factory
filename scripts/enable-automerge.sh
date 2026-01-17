#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/enable-automerge.sh <PR_NUMBER_OR_URL>
USAGE
}

die() {
  echo "ERROR: $*" >&2
  exit 1
}

if ! command -v gh >/dev/null 2>&1; then
  die "gh is required. Install GitHub CLI from https://cli.github.com/"
fi

pr_ref="${1:-}"
if [[ -z "$pr_ref" ]]; then
  usage
  exit 2
fi

gh pr merge "$pr_ref" --auto --squash --delete-branch

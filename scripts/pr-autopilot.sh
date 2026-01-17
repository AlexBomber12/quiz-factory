#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/pr-autopilot.sh <PR_NUMBER_OR_URL>
USAGE
}

pr_ref="${1:-}"
if [[ -z "$pr_ref" ]]; then
  usage
  exit 2
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"${script_dir}/fix-codex-review.sh" "$pr_ref"
"${script_dir}/enable-automerge.sh" "$pr_ref"
"${script_dir}/wait-merged.sh" "$pr_ref"
"${script_dir}/sync-main.sh"

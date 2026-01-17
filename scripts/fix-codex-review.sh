#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/fix-codex-review.sh <PR_NUMBER_OR_URL>
USAGE
}

die() {
  echo "ERROR: $*" >&2
  exit 1
}

pr_ref="${1:-}"
if [[ -z "$pr_ref" ]]; then
  usage
  exit 2
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
max_rounds="${CODEX_REVIEW_FIX_ROUNDS:-2}"
round=1

while (( round <= max_rounds )); do
  if "${script_dir}/wait-codex-review.sh" "$pr_ref"; then
    exit 0
  fi

  status=$?
  if [[ $status -eq 1 ]]; then
    if ! command -v codex >/dev/null 2>&1; then
      die "codex CLI is required. Install or ensure it is on PATH."
    fi
    echo "Codex review requires changes. Running fix round ${round}/${max_rounds}."
    codex exec --full-auto "Fix code review comment. Use artifacts/codex_review.md as the source of truth for what to change."
    round=$((round + 1))
    continue
  fi

  exit "$status"
done

if "${script_dir}/wait-codex-review.sh" "$pr_ref"; then
  exit 0
fi

status=$?
if [[ $status -eq 1 ]]; then
  echo "ERROR: Review still requires changes after ${max_rounds} rounds." >&2
  exit 1
fi

exit "$status"

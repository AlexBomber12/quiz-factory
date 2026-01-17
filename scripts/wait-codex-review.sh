#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: scripts/wait-codex-review.sh must be run inside a git repository." >&2
  exit 1
}
cd "$repo_root"

usage() {
  cat <<'USAGE'
Usage: scripts/wait-codex-review.sh <PR_NUMBER_OR_URL>
USAGE
}

die() {
  echo "ERROR: $*" >&2
  exit 2
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
  die "Unable to resolve PR: $pr_ref"
fi

repo=""
if [[ "$pr_url" =~ github.com/([^/]+)/([^/]+)/pull/ ]]; then
  repo="${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"
fi

if [[ -z "$repo" ]]; then
  die "Unable to resolve repository."
fi

bot_login="${CODEX_REVIEW_BOT_LOGIN:-chatgpt-codex-connector}"
bot_login_suffix="$bot_login"
if [[ "$bot_login" != *"[bot]" ]]; then
  bot_login_suffix="${bot_login}[bot]"
fi
timeout_sec="${CODEX_REVIEW_TIMEOUT_SEC:-1800}"
poll_sec="${CODEX_REVIEW_POLL_SEC:-20}"

start_ts="$(date +%s)"

while true; do
  if ! reviews_json="$(gh api "repos/${repo}/pulls/${pr_number}/reviews")"; then
    die "Unable to fetch reviews for PR #${pr_number}"
  fi

  review_id="$(jq -r --arg bot "$bot_login" --arg bot_suffix "$bot_login_suffix" '[.[] | select(.user.login == $bot or .user.login == $bot_suffix)] | sort_by(.submitted_at) | last | .id // empty' <<<"$reviews_json")"

  if [[ -n "$review_id" ]]; then
    review_state="$(jq -r --arg bot "$bot_login" --arg bot_suffix "$bot_login_suffix" '[.[] | select(.user.login == $bot or .user.login == $bot_suffix)] | sort_by(.submitted_at) | last | .state // empty' <<<"$reviews_json")"
    review_body="$(jq -r --arg bot "$bot_login" --arg bot_suffix "$bot_login_suffix" '[.[] | select(.user.login == $bot or .user.login == $bot_suffix)] | sort_by(.submitted_at) | last | .body // empty' <<<"$reviews_json")"
    review_commit="$(jq -r --arg bot "$bot_login" --arg bot_suffix "$bot_login_suffix" '[.[] | select(.user.login == $bot or .user.login == $bot_suffix)] | sort_by(.submitted_at) | last | .commit_id // empty' <<<"$reviews_json")"
    review_user="$(jq -r --arg bot "$bot_login" --arg bot_suffix "$bot_login_suffix" '[.[] | select(.user.login == $bot or .user.login == $bot_suffix)] | sort_by(.submitted_at) | last | .user.login // empty' <<<"$reviews_json")"

    if ! comments_json="$(gh api "repos/${repo}/pulls/${pr_number}/comments")"; then
      die "Unable to fetch review comments for PR #${pr_number}"
    fi

    inline_comments="$(jq -c --arg bot "$bot_login" --arg bot_suffix "$bot_login_suffix" --argjson review_id "$review_id" '[.[] | select((.user.login == $bot or .user.login == $bot_suffix) and .pull_request_review_id == $review_id)]' <<<"$comments_json")"
    inline_count="$(jq -r 'length' <<<"$inline_comments")"

    mkdir -p artifacts
    {
      echo "# Codex Review"
      echo
      echo "- PR: #${pr_number}"
      echo "- Bot: ${review_user:-$bot_login}"
      echo "- Review state: ${review_state:-unknown}"
      echo "- Reviewed commit: ${review_commit:-unknown}"
      echo
      echo "## Summary"
      echo
      if [[ -n "$review_body" ]]; then
        printf '%s\n' "$review_body"
      else
        echo "(empty)"
      fi
      echo
      echo "## Inline comments"
      echo
      if [[ "$inline_count" == "0" ]]; then
        echo "(none)"
      else
        jq -r '.[] | "- \(.path):\((.line // .original_line // "n/a") | tostring) \(.body | gsub("\r"; "") | gsub("\n"; " "))"' <<<"$inline_comments"
      fi
    } > artifacts/codex_review.md

    approval_phrase="false"
    if [[ -n "$review_body" ]]; then
      review_body_lower="$(printf '%s' "$review_body" | tr '[:upper:]' '[:lower:]')"
      review_body_compact="$(printf '%s' "$review_body_lower" | tr -cd 'a-z')"
      if [[ "$review_body_compact" == "noissuesfound" ]]; then
        approval_phrase="true"
      else
        positive_regex='(^|[^[:alnum:]_])(approved|lgtm|looks good|good to go|ship it)([^[:alnum:]_]|$)'
        negative_regex='(^|[^[:alnum:]_])not[-[:space:]]+(approved|lgtm|looks good|good to go|ship it)([^[:alnum:]_]|$)|(^|[^[:alnum:]_])not[-[:space:]]+yet[-[:space:]]+(approved|lgtm|looks good|good to go|ship it)([^[:alnum:]_]|$)'
        if echo "$review_body_lower" | grep -Eq "$positive_regex"; then
          if ! echo "$review_body_lower" | grep -Eq "$negative_regex"; then
            approval_phrase="true"
          fi
        fi
      fi
    fi

    if [[ "$inline_count" != "0" ]]; then
      exit 1
    fi

    if [[ "$review_state" == "APPROVED" || "$approval_phrase" == "true" ]]; then
      exit 0
    fi

    exit 1
  fi

  now_ts="$(date +%s)"
  if (( now_ts - start_ts >= timeout_sec )); then
    echo "ERROR: Timed out waiting for Codex review after ${timeout_sec}s" >&2
    exit 2
  fi

  sleep "$poll_sec"
done

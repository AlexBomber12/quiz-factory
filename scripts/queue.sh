#!/usr/bin/env bash
set -euo pipefail

QUEUE_FILE="tasks/QUEUE.md"

usage() {
  cat <<'USAGE'
Usage:
  ./scripts/queue.sh start PR-ID
  ./scripts/queue.sh sync
  ./scripts/queue.sh done PR-ID
USAGE
}

die() {
  echo "ERROR: $*" >&2
  exit 1
}

require_queue() {
  if [[ ! -f "$QUEUE_FILE" ]]; then
    die "Missing $QUEUE_FILE"
  fi
}

get_status() {
  local pr_id="$1"
  awk -v pr="$pr_id" '
    function is_entry(line) { return line ~ /^[0-9]+([.][0-9]+)?\) /; }
    BEGIN { status_found = 0; }
    {
      if (is_entry($0)) {
        in_target = ($0 ~ pr);
        if (in_target) { found = 1; }
      }
      if (in_target && $0 ~ /^- Status:/) {
        sub(/^- Status: */, "", $0);
        status_found = 1;
        print $0;
        exit 0;
      }
    }
    END {
      if (!found) {
        print "ERROR: PR not found: " pr > "/dev/stderr";
        exit 3;
      }
      if (!status_found) {
        print "ERROR: Status line not found for " pr > "/dev/stderr";
        exit 4;
      }
    }
  ' "$QUEUE_FILE"
}

update_status() {
  local pr_id="$1"
  local new_status="$2"
  local current_status
  current_status="$(get_status "$pr_id")"

  if [[ "$current_status" == "$new_status" ]]; then
    echo "No change: $pr_id is already $new_status"
    return 0
  fi

  local tmp_file
  tmp_file="$(mktemp)"

  if ! awk -v pr="$pr_id" -v status="$new_status" '
      function is_entry(line) { return line ~ /^[0-9]+([.][0-9]+)?\) /; }
      {
        if (is_entry($0)) {
          if (in_target && !updated) {
            print "ERROR: Status line not found for " pr > "/dev/stderr";
            exit 2;
          }
          in_target = ($0 ~ pr);
          if (in_target) { found = 1; }
        }
        if (in_target && $0 ~ /^- Status:/) {
          sub(/^- Status: .*/, "- Status: " status);
          updated = 1;
          in_target = 0;
        }
        print;
      }
      END {
        if (!found) {
          print "ERROR: PR not found: " pr > "/dev/stderr";
          exit 3;
        }
        if (found && !updated) {
          print "ERROR: Status line not found for " pr > "/dev/stderr";
          exit 4;
        }
      }
    ' "$QUEUE_FILE" > "$tmp_file"; then
    rm -f "$tmp_file"
    exit 1
  fi

  mv "$tmp_file" "$QUEUE_FILE"
  echo "Updated $pr_id status: $current_status -> $new_status"
}

list_doing_prs() {
  awk '
    function is_entry(line) { return line ~ /^[0-9]+([.][0-9]+)?\) /; }
    {
      if (is_entry($0)) {
        current_pr = "";
        if (match($0, /PR-[A-Z0-9-]+/)) {
          current_pr = substr($0, RSTART, RLENGTH);
        } else {
          print "ERROR: Missing PR id on entry line" > "/dev/stderr";
          exit 2;
        }
      }
      if ($0 ~ /^- Status:/) {
        if (!current_pr) {
          print "ERROR: Status line without PR entry" > "/dev/stderr";
          exit 2;
        }
        status = $0;
        sub(/^- Status: */, "", status);
        if (status == "DOING") {
          print current_pr;
        }
      }
    }
  ' "$QUEUE_FILE"
}

is_merged() {
  local pr_id="$1"
  git log origin/main --pretty=%s | grep -q "^${pr_id}:"
}

command="${1:-}"
case "$command" in
  start)
    require_queue
    pr_id="${2:-}"
    if [[ -z "$pr_id" ]]; then
      usage
      exit 2
    fi
    update_status "$pr_id" "DOING"
    ;;
  sync)
    require_queue
    git fetch origin main
    doing_prs="$(list_doing_prs)"
    if [[ -z "$doing_prs" ]]; then
      echo "No DOING entries found."
      exit 0
    fi
    while IFS= read -r pr_id; do
      if [[ -z "$pr_id" ]]; then
        continue
      fi
      if is_merged "$pr_id"; then
        update_status "$pr_id" "DONE"
      else
        echo "Leaving $pr_id as DOING; merge not found on origin/main."
      fi
    done <<< "$doing_prs"
    ;;
  done)
    require_queue
    pr_id="${2:-}"
    if [[ -z "$pr_id" ]]; then
      usage
      exit 2
    fi
    git fetch origin main
    if is_merged "$pr_id"; then
      update_status "$pr_id" "DONE"
    else
      die "Merge not found on origin/main for $pr_id"
    fi
    ;;
  -h|--help|help|"" )
    usage
    exit 0
    ;;
  *)
    usage
    exit 2
    ;;
esac

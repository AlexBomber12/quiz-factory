#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
BASE_URL="${BASE_URL%/}"
TEST_ID="${SMOKE_TEST_ID:-test-focus-rhythm}"

tmp_files=()
cleanup() {
  for file in "${tmp_files[@]}"; do
    rm -f "$file"
  done
}
trap cleanup EXIT

new_tmp() {
  local file
  file="$(mktemp)"
  tmp_files+=("$file")
  printf "%s" "$file"
}

require_status_200() {
  local url="$1"
  local label="$2"
  local status
  status="$(curl -sS -o /dev/null -w "%{http_code}" "$url")"
  if [[ "$status" != "200" ]]; then
    echo "Smoke check failed: ${label} returned ${status} (${url})" >&2
    exit 1
  fi
  echo "ok: ${label}"
}

echo "Running smoke checks against ${BASE_URL}"

health_file="$(new_tmp)"
health_status="$(curl -sS -o "$health_file" -w "%{http_code}" "${BASE_URL}/api/health")"
if [[ "$health_status" != "200" ]]; then
  echo "Smoke check failed: /api/health returned ${health_status}" >&2
  cat "$health_file" >&2
  exit 1
fi
if ! grep -q '"status":"ok"' "$health_file"; then
  echo 'Smoke check failed: /api/health response did not include status "ok"' >&2
  cat "$health_file" >&2
  exit 1
fi
echo "ok: /api/health"

require_status_200 "${BASE_URL}/robots.txt" "/robots.txt"
require_status_200 "${BASE_URL}/sitemap.xml" "/sitemap.xml"

cookie_jar="$(new_tmp)"
start_body_file="$(new_tmp)"
start_status="$(
  curl -sS \
    -c "$cookie_jar" \
    -b "$cookie_jar" \
    -H "content-type: application/json" \
    -H "origin: ${BASE_URL}" \
    -o "$start_body_file" \
    -w "%{http_code}" \
    -X POST \
    "${BASE_URL}/api/test/start" \
    --data "{\"test_id\":\"${TEST_ID}\"}"
)"
if [[ "$start_status" != "200" ]]; then
  echo "Smoke check failed: /api/test/start returned ${start_status}" >&2
  cat "$start_body_file" >&2
  exit 1
fi
echo "ok: /api/test/start"

page_view_body_file="$(new_tmp)"
page_view_status="$(
  curl -sS \
    -c "$cookie_jar" \
    -b "$cookie_jar" \
    -H "content-type: application/json" \
    -H "origin: ${BASE_URL}" \
    -o "$page_view_body_file" \
    -w "%{http_code}" \
    -X POST \
    "${BASE_URL}/api/page/view" \
    --data "{\"test_id\":\"${TEST_ID}\",\"page_type\":\"attempt_entry\",\"page_url\":\"${BASE_URL}/t/${TEST_ID}/run\"}"
)"
if [[ "$page_view_status" != "200" ]]; then
  echo "Smoke check failed: /api/page/view returned ${page_view_status}" >&2
  cat "$page_view_body_file" >&2
  exit 1
fi
echo "ok: /api/page/view"

echo "Smoke checks passed."


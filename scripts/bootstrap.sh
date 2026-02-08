#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

die() {
  echo "bootstrap: $*" >&2
  exit 1
}

copy_if_missing() {
  local source_path="$1"
  local target_path="$2"

  if [[ ! -f "$source_path" ]]; then
    die "missing template file: $source_path"
  fi

  if [[ -e "$target_path" ]]; then
    echo "Keeping existing $target_path"
    return
  fi

  cp "$source_path" "$target_path"
  echo "Created $target_path from $source_path"
}

copy_if_missing "docker-compose.example.yml" "docker-compose.yml"
copy_if_missing ".env.production.example" ".env.production"
copy_if_missing "config/tenants.example.json" "config/tenants.local.json"

if ! command -v openssl >/dev/null 2>&1; then
  die "openssl is required to generate secrets (expected: openssl rand -base64 32)."
fi

declare -A secret_keys=()
for key in \
  ATTEMPT_TOKEN_SECRET \
  REPORT_TOKEN_SECRET \
  RESULT_COOKIE_SECRET \
  ADMIN_SESSION_SECRET \
  RATE_LIMIT_SALT
do
  secret_keys["$key"]=1
done

while IFS= read -r key; do
  if [[ "$key" =~ ^[A-Z0-9_]+_SECRET$ ]]; then
    secret_keys["$key"]=1
  fi
done < <(awk -F "=" '/^[A-Z0-9_]+=/{print $1}' ".env.production.example")

mapfile -t sorted_secret_keys < <(printf "%s\n" "${!secret_keys[@]}" | LC_ALL=C sort)

generated_any=0
for key in "${sorted_secret_keys[@]}"; do
  if ! grep -q "^${key}=CHANGE_ME$" ".env.production"; then
    continue
  fi

  generated_secret="$(openssl rand -base64 32 | tr -d '\r\n')"
  escaped_secret="$(printf "%s" "$generated_secret" | sed -e 's/[\/&]/\\&/g')"
  sed -i -e "s/^${key}=CHANGE_ME$/${key}=${escaped_secret}/" ".env.production"
  generated_any=1
  echo "Generated ${key} in .env.production"
done

if [[ "$generated_any" -eq 0 ]]; then
  echo "No CHANGE_ME secret placeholders found in .env.production"
fi

cat <<'NEXT_STEPS'

Next steps:
1. Edit config/tenants.local.json and set tenant_id + domains (example domain: qf.local).
2. Point qf.local to your Linux host (DNS or /etc/hosts entry, for example: <HOST_IP> qf.local).
3. Start services: docker compose up -d --build
4. Check health: curl -sSf -H "Host: qf.local" http://localhost:3000/api/health

Note:
- docker-compose.yml and .env.production are local working files and are gitignored.
- content-db is not exposed externally by default; use docker-compose.override.yml if you need a local debug port.
NEXT_STEPS

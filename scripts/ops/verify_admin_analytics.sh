#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

is_non_empty() {
  local value
  value="$(trim "${1:-}")"
  [[ -n "$value" ]]
}

has_bigquery_config() {
  is_non_empty "${BIGQUERY_PROJECT_ID:-}" &&
    is_non_empty "${BIGQUERY_STRIPE_DATASET:-}" &&
    is_non_empty "${BIGQUERY_RAW_COSTS_DATASET:-}" &&
    is_non_empty "${BIGQUERY_TMP_DATASET:-}"
}

has_content_db_config() {
  is_non_empty "${CONTENT_DATABASE_URL:-}"
}

resolve_provider_mode() {
  local override_raw override
  override_raw="${ADMIN_ANALYTICS_MODE:-}"
  override="$(trim "$override_raw")"
  override="${override,,}"

  if [[ -n "$override" ]]; then
    case "$override" in
      mock)
        echo "mock"
        return
        ;;
      bigquery)
        if has_bigquery_config; then
          echo "bigquery"
        else
          echo "mock"
        fi
        return
        ;;
      content_db)
        if has_content_db_config; then
          echo "content_db"
        else
          echo "mock"
        fi
        return
        ;;
      *)
        echo "mock"
        return
        ;;
    esac
  fi

  if has_bigquery_config; then
    echo "bigquery"
    return
  fi

  if has_content_db_config; then
    echo "content_db"
    return
  fi

  echo "mock"
}

run_content_db_checks() {
  local status=0

  set +e
  (
    cd "$ROOT_DIR/apps/web"
    node <<'NODE'
const { Pool } = require("pg");

const connectionString = process.env.CONTENT_DATABASE_URL;
if (!connectionString || !connectionString.trim()) {
  console.error("[error] CONTENT_DATABASE_URL is empty.");
  process.exit(2);
}

const tables = ["analytics_events", "stripe_purchases", "tenant_tests"];
const pool = new Pool({ connectionString });
let client;
let missingTable = false;

const queryCount = async (tableName) => {
  const result = await client.query(`SELECT COUNT(*) AS count FROM ${tableName}`);
  const count = result.rows?.[0]?.count ?? "0";
  console.log(`[ok] ${tableName}: ${count} rows`);
};

(async () => {
  try {
    client = await pool.connect();
    for (const tableName of tables) {
      try {
        await queryCount(tableName);
      } catch (error) {
        if (error && error.code === "42P01") {
          missingTable = true;
          console.log(`[warn] Missing table: ${tableName}`);
          continue;
        }
        throw error;
      }
    }

    if (missingTable) {
      console.log(
        "[hint] Run content DB migrations: pnpm --filter @quiz-factory/web db:migrate"
      );
      process.exit(20);
    }

    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[error] Unable to run content DB checks: ${message}`);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end().catch(() => undefined);
  }
})();
NODE
  )
  status=$?
  set -e

  return "$status"
}

bigquery_configured="no"
content_db_configured="no"
selected_mode=""
misconfigured=0

if has_bigquery_config; then
  bigquery_configured="yes"
fi

if has_content_db_config; then
  content_db_configured="yes"
fi

override_display="<unset>"
if is_non_empty "${ADMIN_ANALYTICS_MODE:-}"; then
  override_display="$(trim "${ADMIN_ANALYTICS_MODE:-}")"
fi

selected_mode="$(resolve_provider_mode)"

echo "==> Admin analytics environment verification"
echo "[info] ADMIN_ANALYTICS_MODE override: ${override_display}"
echo "[info] BigQuery env configured: ${bigquery_configured}"
echo "[info] CONTENT_DATABASE_URL configured: ${content_db_configured}"
echo "[info] Selected analytics provider mode: ${selected_mode}"

if [[ "$override_display" != "<unset>" ]]; then
  lowered_override="${override_display,,}"
  case "$lowered_override" in
    mock)
      ;;
    bigquery)
      if [[ "$bigquery_configured" != "yes" ]]; then
        misconfigured=1
        echo "[warn] ADMIN_ANALYTICS_MODE=bigquery but required BigQuery env vars are missing. Code will fall back to mock."
      fi
      ;;
    content_db)
      if [[ "$content_db_configured" != "yes" ]]; then
        misconfigured=1
        echo "[warn] ADMIN_ANALYTICS_MODE=content_db but CONTENT_DATABASE_URL is missing. Code will fall back to mock."
      fi
      ;;
    *)
      misconfigured=1
      echo "[warn] Unsupported ADMIN_ANALYTICS_MODE=${override_display}. Code will fall back to mock."
      ;;
  esac
fi

if [[ "$content_db_configured" == "yes" ]]; then
  echo "[info] Checking content DB analytics tables..."
  set +e
  run_content_db_checks
  content_db_check_status=$?
  set -e
  if [[ "$content_db_check_status" -eq 20 ]]; then
    echo "[warn] Content DB analytics tables are incomplete."
  elif [[ "$content_db_check_status" -ne 0 ]]; then
    misconfigured=1
  fi
else
  echo "[info] Skipping content DB table checks because CONTENT_DATABASE_URL is not set."
fi

if [[ "$misconfigured" -ne 0 ]]; then
  echo "[error] Verification detected clear misconfiguration."
  exit 1
fi

echo "[ok] Verification completed."

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCOPE="all"
SKIP_PNPM_INSTALL=0
SKIP_UV_SYNC=0

usage() {
  cat <<'USAGE'
Usage: scripts/ci.sh [--scope app|analytics] [--skip-install] [--skip-uv-sync]
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --scope)
      SCOPE="${2:-}"
      shift 2
      ;;
    --skip-install)
      SKIP_PNPM_INSTALL=1
      shift
      ;;
    --skip-uv-sync)
      SKIP_UV_SYNC=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      usage
      exit 2
      ;;
  esac
done

run_app() {
  echo "==> Node checks"
  cd "$ROOT_DIR"
  corepack enable
  if [[ "$SKIP_PNPM_INSTALL" -eq 0 ]]; then
    pnpm install --frozen-lockfile
  fi
  pnpm lint
  pnpm typecheck
  pnpm test
  pnpm build
  echo "==> Tenants validation"
  python3 "$ROOT_DIR/scripts/tenants/validate_tenants.py"
  echo "==> Content catalog validation"
  python3 "$ROOT_DIR/scripts/content/validate_catalog.py"
}

ensure_uv() {
  if command -v uv >/dev/null 2>&1; then
    return
  fi

  echo "uv not found; installing..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
  hash -r
}

run_analytics() {
  echo "==> Analytics checks"
  ensure_uv
  pushd "$ROOT_DIR/analytics/dbt" >/dev/null
  if [[ "$SKIP_UV_SYNC" -eq 0 ]]; then
    uv sync --frozen
  fi
  echo "==> Importer unit tests"
  uv run python "$ROOT_DIR/scripts/importers/meta_ads_to_bq_test.py"
  export DBT_PROFILES_DIR="$PWD"
  uv run dbt deps
  uv run dbt parse
  if [[ "${CI:-}" == "true" || "${CI:-}" == "1" ]]; then
    uv run dbt build
  else
    echo "Skipping dbt build outside CI; set CI=true to run analytics tests."
  fi
  popd >/dev/null
}

case "$SCOPE" in
  all)
    run_app
    run_analytics
    ;;
  app)
    run_app
    ;;
  analytics)
    run_analytics
    ;;
  *)
    echo "Invalid scope: $SCOPE"
    usage
    exit 2
    ;;
esac

# Analytics

The dbt project lives in `analytics/dbt` and uses BigQuery via the dbt adapter.

Notes:
- CI runs `dbt parse` (and `dbt deps`) only; `dbt compile` requires a warehouse connection and credentials.
- Local installs use `uv sync --frozen` so `uv.lock` stays authoritative.

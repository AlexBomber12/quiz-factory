# Analytics

The dbt project lives in `analytics/dbt` and uses BigQuery via the dbt adapter.

Notes:
- CI runs `dbt build` after `dbt deps` and `dbt parse`, so a warehouse connection and credentials are required.
- Local installs use `uv sync --frozen` so `uv.lock` stays authoritative.

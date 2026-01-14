# Analytics Safety Checks

## What the guards do
- Dataset guard: `analytics/dbt/tests/schema_dataset_guard.sql` runs as a dbt data test and fails if any dbt model relation is found outside the `tmp` and `marts` datasets.
- Cost or spend gap check: `mart_pnl_missing_cost_spend_daily` returns dates where costs or spend exist but `marts.mart_pnl_daily` has no rows for the date.
- Cost contribution gap check: `mart_pnl_missing_cost_contribution_daily` returns dates where costs exist but `marts.mart_pnl_daily` has no cost allocations.

These checks run during the analytics CI step in `scripts/ci.sh` via `dbt build`.

## Debugging failures
- Dataset guard
  - Confirm dbt schema settings in `analytics/dbt/dbt_project.yml` and `analytics/dbt/macros/generate_schema_name.sql`.
  - Verify the dataset environment variables like `DBT_BIGQUERY_DATASET`.
  - Inspect BigQuery for unexpected datasets that match dbt model names.
- Cost or spend gap
  - Check `raw_costs.costs_daily` and `marts.mart_spend_mapped_daily` for the failing date.
  - Verify that `marts.mart_pnl_daily` has rows for the same date.
  - Rebuild with `uv run dbt build --select mart_pnl_daily --full-refresh` if the date is outside the incremental lookback.
- Cost contribution gap
  - Compare daily totals from `raw_costs.costs_daily` to the cost columns in `marts.mart_pnl_daily`.
  - Check for missing visit allocation in `marts.mart_funnel_daily` and look for `__unallocated__` rows in `marts.mart_pnl_daily`.

## If a dataset mismatch is detected
- Stop dbt runs and confirm which dataset is unexpected.
- Fix schema configuration or environment variables so dbt writes only to `tmp` and `marts`.
- Remove or archive the unexpected dataset after confirming it is safe to delete.
- Re-run `uv run dbt build` to recreate the expected relations.

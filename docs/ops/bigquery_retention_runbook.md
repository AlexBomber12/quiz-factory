# BigQuery Retention Runbook

## Purpose
Apply retention for EU analytics datasets safely and consistently.

## Preconditions
- Confirm the retention windows in `docs/analytics/retention.md`.
- Use the analytics project that owns `raw_posthog`, `raw_stripe`, `raw_costs`, and `marts`.
- Ensure you have BigQuery permissions to alter tables and run deletes.

## Apply retention
1) Set partition expiration on partitioned tables.
   - Script: `analytics/bigquery/retention/set_partition_expiration.sql`
   - Command example:
     - `bq query --use_legacy_sql=false < analytics/bigquery/retention/set_partition_expiration.sql`

2) For tables that cannot use partition expiration, run the fallback delete script.
   - Script: `analytics/bigquery/retention/delete_old_rows.sql`
   - Edit the script to set `cutoff_date` explicitly, for example:
     - `DECLARE cutoff_date DATE DEFAULT DATE "2024-01-01";`
   - Command example:
     - `bq query --use_legacy_sql=false < analytics/bigquery/retention/delete_old_rows.sql`

## Dry run and safety checks
- Before deletes, run a count with the same filter:
  - `SELECT COUNT(*) FROM raw_posthog.events WHERE DATE(timestamp) < DATE "2024-01-01";`
- Use `bq query --dry_run --use_legacy_sql=false` on read-only checks to validate bytes scanned.
- Partition expiration only removes data after partitions age out, so it is lower risk than immediate deletes.

## Verify
- Check partition expiration settings:
  - `SELECT table_name, option_value FROM raw_posthog.INFORMATION_SCHEMA.TABLE_OPTIONS WHERE option_name = "partition_expiration_days";`
  - `SELECT table_name, option_value FROM raw_stripe.INFORMATION_SCHEMA.TABLE_OPTIONS WHERE option_name = "partition_expiration_days";`
- Check oldest data after cleanup:
  - `SELECT MIN(DATE(timestamp)) AS oldest_event FROM raw_posthog.events;`
  - `SELECT MIN(DATE(created_utc)) AS oldest_stripe_event FROM raw_stripe.webhook_events_min;`

## Rollback
- Disable expiration by setting `partition_expiration_days = NULL` for affected tables.
- For deleted data, restore from a snapshot table, backup export, or BigQuery time travel if still available.
- For safety, consider creating a snapshot before running deletes:
  - `CREATE SNAPSHOT TABLE raw_posthog.events_backup AS SELECT * FROM raw_posthog.events;`

## Monitor storage growth
- Track storage bytes by dataset and table:
  - `SELECT table_name, total_logical_bytes FROM raw_posthog.INFORMATION_SCHEMA.TABLE_STORAGE;`
  - `SELECT table_name, total_logical_bytes FROM raw_stripe.INFORMATION_SCHEMA.TABLE_STORAGE;`
- Review monthly and compare to retention targets to confirm storage is stabilizing.

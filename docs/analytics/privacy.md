# Analytics Privacy and Access Boundaries

## Access policy
- raw_* datasets are restricted to analytics engineers and operators.
- raw_posthog.events_clean is the approved source for dbt staging.
- marts is suitable for broader reporting access.

## What is stored where
- raw_posthog.events stores the raw PostHog export with JSON properties.
- raw_posthog.events_clean is a view that drops ip, set, set_once, and other unused columns, keeping only the fields needed for dbt staging.
- marts contains analytics-ready tables built from dbt models.

## Retention guidance
- raw_posthog can have shorter retention than marts.
- marts can be retained longer for reporting and finance needs.
- Use docs/metrics.md as the source of truth for retention defaults.

## How to audit that ip is not used
1. Confirm the clean view has no ip column:

```sql
select column_name
from raw_posthog.INFORMATION_SCHEMA.COLUMNS
where table_name = 'events_clean'
  and column_name = 'ip';
```

2. Confirm new rows in raw_posthog.events have null ip values:

```sql
select countif(ip is not null) as ip_rows
from raw_posthog.events
where timestamp >= timestamp_sub(current_timestamp(), interval 7 day);
```

3. Confirm dbt staging reads from the clean view:
- analytics/dbt/models/staging/posthog/stg_posthog_events.sql

## Retention automation steps
If you want automated retention, create a BigQuery scheduled query that deletes rows older than the retention window.

Example steps:
1. Choose the retention window for raw_posthog in line with docs/metrics.md.
2. In BigQuery Scheduled Queries, create a new job against the analytics project.
3. Use a statement like:

```sql
delete from raw_posthog.events
where timestamp < timestamp_sub(current_timestamp(), interval 18 month);
```

4. Run the query once manually and review the affected row count.
5. Schedule the query and document the owner and cadence in your ops runbook.

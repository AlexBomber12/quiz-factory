-- BigQuery cost observability tables.

CREATE TABLE IF NOT EXISTS marts.mart_bq_cost_daily (
  date DATE,
  total_bytes_processed INT64,
  total_bytes_billed INT64,
  total_slot_ms INT64,
  job_count INT64,
  top_job_type STRING,
  top_job_type_bytes_billed INT64
)
PARTITION BY date;

CREATE TABLE IF NOT EXISTS marts.mart_bq_cost_jobs_recent (
  creation_date DATE,
  job_id STRING,
  project_id STRING,
  user_email STRING,
  job_type STRING,
  statement_type STRING,
  priority STRING,
  total_bytes_processed INT64,
  total_bytes_billed INT64,
  total_slot_ms INT64,
  cache_hit BOOL,
  labels ARRAY<STRUCT<key STRING, value STRING>>,
  creation_time TIMESTAMP,
  start_time TIMESTAMP,
  end_time TIMESTAMP
)
PARTITION BY creation_date
CLUSTER BY job_type, statement_type;

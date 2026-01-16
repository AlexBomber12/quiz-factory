-- Populate marts.mart_bq_cost_daily for a single run_date.
-- Set run_date before execution to backfill.

DECLARE run_date DATE DEFAULT DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY);

DELETE FROM marts.mart_bq_cost_daily
WHERE date = run_date;

INSERT INTO marts.mart_bq_cost_daily (
  date,
  total_bytes_processed,
  total_bytes_billed,
  total_slot_ms,
  job_count,
  top_job_type,
  top_job_type_bytes_billed
)
WITH jobs AS (
  SELECT
    DATE(creation_time) AS date,
    job_type,
    total_bytes_processed,
    total_bytes_billed,
    total_slot_ms
  FROM `region-eu`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
  WHERE state = "DONE"
    AND DATE(creation_time) = run_date
),
daily AS (
  SELECT
    date,
    SUM(COALESCE(total_bytes_processed, 0)) AS total_bytes_processed,
    SUM(COALESCE(total_bytes_billed, 0)) AS total_bytes_billed,
    SUM(COALESCE(total_slot_ms, 0)) AS total_slot_ms,
    COUNT(*) AS job_count
  FROM jobs
  GROUP BY date
),
job_type_bytes AS (
  SELECT
    date,
    job_type,
    SUM(COALESCE(total_bytes_billed, 0)) AS bytes_billed
  FROM jobs
  GROUP BY date, job_type
),
top_job_type AS (
  SELECT
    date,
    ARRAY_AGG(
      STRUCT(job_type, bytes_billed)
      ORDER BY bytes_billed DESC
      LIMIT 1
    )[OFFSET(0)] AS top_job_type_entry
  FROM job_type_bytes
  GROUP BY date
)
SELECT
  daily.date,
  daily.total_bytes_processed,
  daily.total_bytes_billed,
  daily.total_slot_ms,
  daily.job_count,
  top_job_type.top_job_type_entry.job_type AS top_job_type,
  top_job_type.top_job_type_entry.bytes_billed AS top_job_type_bytes_billed
FROM daily
LEFT JOIN top_job_type USING (date);

-- Refresh mart_bq_cost_jobs_recent with the 50 most expensive jobs in the last 7 days.

DECLARE window_start DATE DEFAULT DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY);

TRUNCATE TABLE marts.mart_bq_cost_jobs_recent;

INSERT INTO marts.mart_bq_cost_jobs_recent (
  creation_date,
  job_id,
  project_id,
  user_email,
  job_type,
  statement_type,
  priority,
  total_bytes_processed,
  total_bytes_billed,
  total_slot_ms,
  cache_hit,
  labels,
  creation_time,
  start_time,
  end_time
)
SELECT
  DATE(creation_time) AS creation_date,
  job_id,
  project_id,
  user_email,
  job_type,
  statement_type,
  priority,
  total_bytes_processed,
  total_bytes_billed,
  total_slot_ms,
  cache_hit,
  labels,
  creation_time,
  start_time,
  end_time
FROM `region-eu`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
WHERE state = "DONE"
  AND DATE(creation_time) >= window_start
ORDER BY COALESCE(total_bytes_billed, 0) DESC
LIMIT 50;

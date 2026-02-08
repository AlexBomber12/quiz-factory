CREATE TABLE IF NOT EXISTS attempt_summaries (
  tenant_id text NOT NULL,
  test_id text NOT NULL,
  session_id text NOT NULL,
  distinct_id text NOT NULL,
  locale text NOT NULL,
  computed_at timestamptz NOT NULL,
  band_id text NOT NULL,
  scale_scores jsonb NOT NULL,
  total_score integer NOT NULL,
  PRIMARY KEY (tenant_id, test_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_attempt_summaries_tenant_session
  ON attempt_summaries (tenant_id, session_id);

CREATE TABLE IF NOT EXISTS report_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id text NOT NULL UNIQUE,
  tenant_id text NOT NULL,
  test_id text NOT NULL,
  session_id text NOT NULL,
  locale text NOT NULL,
  status text NOT NULL CHECK (status IN ('queued', 'running', 'ready', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_report_jobs_status_updated_at
  ON report_jobs (status, updated_at);

CREATE TABLE IF NOT EXISTS report_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id text NOT NULL UNIQUE,
  tenant_id text NOT NULL,
  test_id text NOT NULL,
  session_id text NOT NULL,
  locale text NOT NULL,
  style_id text NOT NULL,
  model text NOT NULL,
  prompt_version text NOT NULL,
  scoring_version text NOT NULL,
  report_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS report_jobs_set_updated_at ON report_jobs;
CREATE TRIGGER report_jobs_set_updated_at
BEFORE UPDATE ON report_jobs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

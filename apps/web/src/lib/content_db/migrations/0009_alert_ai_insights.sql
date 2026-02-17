CREATE TABLE IF NOT EXISTS alert_ai_insights (
  alert_instance_id uuid PRIMARY KEY REFERENCES alert_instances(id) ON DELETE CASCADE,
  model text NOT NULL,
  prompt_hash text NOT NULL,
  insight_md text NOT NULL,
  actions_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_ai_insights_created_at
  ON alert_ai_insights (created_at DESC);

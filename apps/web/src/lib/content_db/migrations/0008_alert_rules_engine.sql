CREATE TABLE IF NOT EXISTS alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT TRUE,
  rule_type text NOT NULL CHECK (
    rule_type IN (
      'conversion_drop',
      'revenue_drop',
      'refund_spike',
      'traffic_spike',
      'data_freshness_fail'
    )
  ),
  scope_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  params_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled_rule_type
  ON alert_rules (enabled, rule_type);

DROP TRIGGER IF EXISTS alert_rules_set_updated_at ON alert_rules;
CREATE TRIGGER alert_rules_set_updated_at
BEFORE UPDATE ON alert_rules
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS alert_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  severity text NOT NULL CHECK (severity IN ('info', 'warn', 'critical')),
  fired_at timestamptz NOT NULL,
  context_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  fingerprint text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_instances_fired_at
  ON alert_instances (fired_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_instances_status_severity
  ON alert_instances (status, severity);

CREATE INDEX IF NOT EXISTS idx_alert_instances_rule_id
  ON alert_instances (rule_id);

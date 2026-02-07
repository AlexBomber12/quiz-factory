CREATE TABLE IF NOT EXISTS admin_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  at timestamptz NOT NULL DEFAULT now(),
  actor_role text NOT NULL CHECK (actor_role IN ('admin', 'editor')),
  actor_hint text,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  meta_json jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_events_at
  ON admin_audit_events (at DESC);

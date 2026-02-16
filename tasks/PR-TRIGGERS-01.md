PR-TRIGGERS-01: Alerts Rules Engine (Rules, Instances, Runner, UI)

Read and follow AGENTS.md strictly.

Context
- The admin control panel should automate operations using triggers: detect issues and opportunities.
- We already have anomaly SQL templates in analytics/bigquery/alerts, but we need an in-app engine:
  - define rules in UI
  - evaluate on schedule
  - store alert instances
  - show them in admin

Goal
- Implement a triggers engine in Content DB and Admin UI:
  - alert_rules: definition
  - alert_instances: occurrences with severity and links to tenant/content
  - evaluation runner endpoint for scheduled execution
  - admin pages to manage rules and review alerts

Non-goals
- Do not implement AI insights in this PR.
- Do not require BigQuery; must work with provider abstraction.

Implementation requirements
- DB schema
  - Add migration creating:
    - alert_rules:
      - id uuid PK
      - name text
      - enabled boolean
      - rule_type text (conversion_drop, revenue_drop, refund_spike, traffic_spike, data_freshness_fail)
      - scope_json jsonb (tenant_id optional, content_type optional, content_key optional)
      - params_json jsonb (thresholds, lookback window, baseline window)
      - created_at, updated_at
    - alert_instances:
      - id uuid PK
      - rule_id uuid FK
      - status text (open, acknowledged, resolved)
      - severity text (info, warn, critical)
      - fired_at timestamptz
      - context_json jsonb (resolved tenant/content ids, metrics snapshot)
      - fingerprint text UNIQUE (to dedupe repeats within a window)
      - created_at
- Runner
  - Add internal endpoint:
    - POST /api/internal/alerts/run
    - protected by new env secret ALERTS_RUNNER_SECRET (add to .env.example)
    - supports query params: rule_id optional, dry_run optional
  - Evaluation logic:
    - use provider abstraction to fetch required aggregates (BQ or content_db)
    - compute rules deterministically
    - write alert_instances with dedupe by fingerprint
- Admin UI
  - /admin/alerts: list instances, filters (status, severity, tenant, rule_type), acknowledge/resolve actions
  - /admin/alerts/rules: list/create/edit rules, enable/disable, “Run now” button
  - Audit logging for rule changes and acknowledgements
- Testing
  - unit tests for evaluation logic with mock provider
  - basic API tests for runner secret enforcement

Workflow rules
- Create a new branch from main named: pr-triggers-01-alerts-engine
- Implement only what this task requests.

Definition of Done
- Rules can be created/edited in UI and stored in DB.
- Runner can execute rules and create deduped instances.
- Alerts are visible in admin and can be acknowledged/resolved.
- scripts/ci.sh --scope app passes.

PR-AI-INSIGHTS-01: AI Insights for Alerts (Action Center)

Read and follow AGENTS.md strictly.

Context
- Triggers without recommendations create noise. We want actions.
- The platform already integrates an LLM pipeline for reports; we will reuse the LLM client patterns.
- AI must be cost-controlled and safe (no PII, explicit caching).

Goal
- Add AI-generated insights and recommended actions for alert instances:
  - short explanation of why the alert fired
  - 3-7 suggested actions with expected impact and risk
  - stored and reusable (no repeated calls unless explicitly re-run)

Non-goals
- Do not auto-apply changes in production (no autonomous actions).
- Do not generate or store PII.

Implementation requirements
- DB schema
  - Add migration creating:
    - alert_ai_insights:
      - alert_instance_id uuid PK REFERENCES alert_instances(id) ON DELETE CASCADE
      - model text
      - prompt_hash text
      - insight_md text
      - actions_json jsonb
      - created_at timestamptz
- API
  - POST /api/admin/alerts/[id]/insight
    - generates insight if missing or if force=true
    - uses existing OpenAI client configuration
    - validates admin role (admin/editor)
    - stores insight in DB
  - GET /api/admin/alerts/[id]/insight
- Prompting
  - Build a deterministic prompt that includes:
    - rule type, thresholds, lookback windows
    - tenant + content identifiers
    - recent metrics snapshot and baseline
    - constraints: no PII, no raw user text, no external links required
  - Return structured outputs:
    - summary
    - root_cause_hypotheses (short)
    - actions (array with title, steps, expected_effect, risk_level)
- UI
  - Create /admin/action-center (or extend /admin/alerts):
    - list alerts
    - show insight panel for selected alert
    - “Generate insight” button with loading state
- Cost controls
  - cache by alert_instance_id + prompt_hash
  - require explicit user action to regenerate
- Testing
  - mock LLM client in tests
  - verify caching behavior and auth checks

Workflow rules
- Create a new branch from main named: pr-ai-insights-01
- Implement only what this task requests.

Definition of Done
- Admin can generate and view AI insights for an alert.
- Insights are cached and not regenerated unless requested.
- No PII is included in prompts or stored outputs.
- scripts/ci.sh --scope app passes.

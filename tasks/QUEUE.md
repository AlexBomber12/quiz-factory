QUEUE

Purpose
- Execute analytics PRs in order, without skipping.
- Each PR should be implemented exactly as described in its corresponding tasks file.

Status legend
- TODO: not started
- DOING: in progress
- DONE: merged to main

Queue (in order)

1) PR-ANALYTICS-01: Metrics spec (single source of truth)
- Status: DONE
- Tasks file: tasks/PR-ANALYTICS-01.md
- Depends on: none

1.5) PR-FIX-ANALYTICS-01: Events contract fix
- Status: DONE
- Tasks file: tasks/PR-FIX-ANALYTICS-01.md
- Depends on: PR-ANALYTICS-01

2) PR-ANALYTICS-02: Server-side Tracking and session_id
- Status: DONE
- Tasks file: tasks/PR-ANALYTICS-02.md
- Depends on: PR-ANALYTICS-01 and PR-FIX-ANALYTICS-01

3) PR-ANALYTICS-03: Stripe Webhooks, Finance Facts, and Tracking Alignment
- Status: DONE
- Tasks file: tasks/PR-ANALYTICS-03.md
- Depends on: PR-ANALYTICS-02
- Outcome:
  - Stripe webhooks stored as raw-minimized facts (no PII)
  - normalized purchases/refunds/disputes/fees tables in BigQuery
  - backend-only finance events emitted to PostHog
  - tracking identifiers aligned (distinct_id vs session_id)

4) PR-ANALYTICS-04: BigQuery Bootstrap, PostHog Export Wiring, dbt Scaffold (Revised)
- Status: DONE
- Tasks file: tasks/PR-ANALYTICS-04.md
- Depends on: PR-ANALYTICS-03
- Outcome:
  - raw_posthog/raw_costs/marts datasets and tables
  - PostHog BigQuery export configured for events model
  - dbt scaffold ready

5) PR-ANALYTICS-05: dbt Marts (P&L Daily, Funnel Daily, Unit Econ) + Data Quality (Revised)
- Status: TODO
- Tasks file: tasks/PR-ANALYTICS-05.md
- Depends on: PR-ANALYTICS-04
- Outcome:
  - marts tables built via dbt (including reconciliation)
  - incremental models and tests

6) PR-ANALYTICS-06: Dashboards (P&L Daily, Funnel Daily) (Revised)
- Status: TODO
- Tasks file: tasks/PR-ANALYTICS-06.md
- Depends on: PR-ANALYTICS-05
- Outcome:
  - reproducible dashboard specs
  - canonical SQL library
  - alerting spec

7) PR-ANALYTICS-07: Costs, Ad Spend Import (1 channel), Campaign Mapping, and Profit Marts (Revised)
- Status: TODO
- Tasks file: tasks/PR-ANALYTICS-07.md
- Depends on: PR-ANALYTICS-06
- Outcome:
  - costs and spend loaded (CSV-first)
  - spend mapped via campaign_map
  - contribution margin and CAC computed in marts

Execution rules (apply to every PR)
- Work on exactly 1 PR at a time.
- Create a new branch from main named pr-analytics-0X-<short-slug>.
- Implement only what the tasks file requests.
- Run the project test gate locally before committing.
- Do not commit secrets. Do not add or modify .env except .env.example if the task explicitly says so.
- When green, commit with message "PR-ANALYTICS-0X: <short summary>" and push the branch.

Definition of Done (global)
- A single query of marts.mart_pnl_daily clearly shows:
  - gross, refunds, disputes, fees, ad_spend, content, infra, tools, other, contribution_margin
  - by day and tenant_id
- A single query of marts.mart_funnel_daily clearly shows:
  - step counts and conversion rates by day, tenant_id, test_id, locale, channel_key
- Unit economics is explainable from tables, with no manual spreadsheet glue.

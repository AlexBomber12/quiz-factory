# Queue

Purpose
- Execute analytics PRs in order, without skipping.
- Each PR should be implemented exactly as described in its corresponding tasks file.

Status legend
- TODO: not started
- DOING: in progress
- DONE: merged to main

Queue (in order)
1)PR-ANALYTICS-01.md
Status:DONE
1.5)PR-FIX-ANALYTICS-01.md 
Status:DONE


2) PR-ANALYTICS-02: Server-side Tracking and session_id
- Status: TODO
- Tasks file: tasks/PR-ANALYTICS-02.md
- Depends on: PR-ANALYTICS-01
- Outcome: server-side PostHog tracking with stable tenant_id + session_id + utm persistence

3) PR-ANALYTICS-03: Stripe Webhooks to raw_stripe and Purchase Events
- Status: TODO
- Tasks file: tasks/PR-ANALYTICS-03.md
- Depends on: PR-ANALYTICS-02
- Outcome: Stripe webhooks stored as raw + normalized facts, purchase_success emitted server-side, fees recorded

4) PR-ANALYTICS-04: BigQuery Bootstrap, PostHog Export Wiring, dbt Scaffold
- Status: TODO
- Tasks file: tasks/PR-ANALYTICS-04.md
- Depends on: PR-ANALYTICS-03
- Outcome: BigQuery datasets/tables + PostHog export setup docs + dbt project scaffold

5) PR-ANALYTICS-05: dbt Marts (P&L Daily, Funnel Daily, Unit Econ) + Data Quality
- Status: TODO
- Tasks file: tasks/PR-ANALYTICS-05.md
- Depends on: PR-ANALYTICS-04
- Outcome: marts tables (pnl_daily, funnel_daily, unit_econ_daily) built via dbt with tests and freshness checks

6) PR-ANALYTICS-06: Dashboards (P&L Daily, Funnel Daily)
- Status: TODO
- Tasks file: tasks/PR-ANALYTICS-06.md
- Depends on: PR-ANALYTICS-05
- Outcome: reproducible dashboards spec (Metabase or Looker Studio) + saved SQL queries for core views

7) PR-ANALYTICS-07: Costs and Ad Spend Import (1 channel) + P&L Join
- Status: TODO
- Tasks file: tasks/PR-ANALYTICS-07.md
- Depends on: PR-ANALYTICS-06
- Outcome: costs tables + ad spend import (CSV path must work) + contribution margin and CAC in marts

Execution rules (apply to every PR)
- Work on exactly 1 PR at a time.
- Create a new branch from main named pr-analytics-0X-<short-slug>.
- Implement only what the tasks file requests.
- Run the project test gate locally before committing.
- Do not commit secrets. Do not add or modify .env except .env.example if explicitly requested.
- When green, commit with message "PR-ANALYTICS-0X: <short summary>" and push the branch.

Definition of Done (global)
- A single query of marts.mart_pnl_daily clearly shows: gross, refunds, disputes, fees, ad_spend, content, infra, contribution_margin for any day and tenant_id.
- A single query of marts.mart_funnel_daily clearly shows: step counts and conversion rates by day, tenant_id, test_id, locale, channel.
- Unit economics is explainable from tables, with no manual spreadsheet glue.

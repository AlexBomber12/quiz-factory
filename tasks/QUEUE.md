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

4) PR-ANALYTICS-04: BigQuery Bootstrap, PostHog Export Wiring, dbt Scaffold
- Status: DONE
- Tasks file: tasks/PR-ANALYTICS-04.md
- Depends on: PR-ANALYTICS-03
- Outcome:
  - raw_posthog/raw_costs/marts datasets and tables
  - PostHog BigQuery export configured for events model
  - dbt scaffold ready

5) PR-ANALYTICS-05: dbt Marts (P&L Daily, Funnel Daily, Unit Econ) + Data Quality
- Status: DONE
- Tasks file: tasks/PR-ANALYTICS-05.md
- Depends on: PR-ANALYTICS-04
- Outcome:
  - marts tables built via dbt (including reconciliation)
  - incremental models and tests

6) PR-ANALYTICS-06: Dashboards (P&L Daily, Funnel Daily)
- Status: DONE
- Tasks file: tasks/PR-ANALYTICS-06.md
- Depends on: PR-ANALYTICS-05
- Outcome:
  - reproducible dashboard specs
  - canonical SQL library
  - alerting spec

7) PR-ANALYTICS-07: Costs and Ad Spend Import (1 channel) + Profit Marts
- Status: DONE
- Tasks file: tasks/PR-ANALYTICS-07.md
- Depends on: PR-ANALYTICS-06
- Outcome:
  - costs and spend loaded (CSV-first)
  - spend mapped via campaign_map
  - contribution margin and CAC computed in marts

8) PR-ANALYTICS-08: BigQuery EU Location Alignment and dbt Schema Fix
- Status: DONE
- Tasks file: tasks/PR-ANALYTICS-08.md
- Depends on: PR-ANALYTICS-07
- Outcome:
  - BigQuery bootstrap scripts use EU location
  - dbt outputs staging models to tmp and marts models to marts dataset
  - docs reflect EU as the standard
  - no cross-location queries

9) PR-ANALYTICS-09: Tenant Registry and Locale Resolution
- Status: DONE
- Tasks file: tasks/PR-ANALYTICS-09.md
- Depends on: PR-ANALYTICS-08
- Outcome:
  - tenant_id and locale are resolved server-side from tenant config (Accept-Language fallback)
  - locale is always non-null in server-side tracking and finance events
  - tenant resolution supports 200 domains without code changes

10) PR-ANALYTICS-10: Implement page_view
- Status: DONE
- Tasks file: tasks/PR-ANALYTICS-10.md
- Depends on: PR-ANALYTICS-09
- Outcome:
  - page_view event is emitted for each attempt at least once
  - mart_funnel_daily visits and unique_visitors are non-zero and meaningful

11) PR-ANALYTICS-11: Implement analytics/events.json (Full Coverage) + Contract Enforcement
- Status: TODO
- Tasks file: tasks/PR-ANALYTICS-11.md
- Depends on: PR-ANALYTICS-10
- Outcome:
  - every event defined in analytics/events.json has a corresponding API route or backend emission path
  - purchase_failed is emitted from Stripe failure webhooks
  - share_click and upsell events have server-side routes
  - a test asserts code event names match analytics/events.json keys

12) PR-OPS-POSTHOG-01: Drop IP capture and disable GeoIP enrichment
- Status: TODO
- Tasks file: tasks/PR-OPS-POSTHOG-01.md
- Depends on: PR-ANALYTICS-11
- Outcome:
  - PostHog capture payload sets $geoip_disable=true for server-side events
  - PostHog instance is configured to discard client IP data (documented and verified)
  - BigQuery export contains no real IP values

Execution rules (apply to every PR)
- Work on exactly 1 PR at a time.
- Create a new branch from main named pr-analytics-0X-<short-slug> (or pr-ops-<name> for ops PRs).
- Implement only what the tasks file requests.
- Run the project test gate locally before committing.
- Do not commit secrets. Do not add or modify .env except .env.example if the task explicitly says so.
- When green, commit with message "PR-ANALYTICS-0X: <short summary>" (or "PR-OPS-POSTHOG-01: <summary>") and push the branch.

Definition of Done (global)
- A single query of marts.mart_pnl_daily clearly shows:
  - gross, refunds, disputes, fees, ad_spend, content, infra, tools, other, contribution_margin
  - by day and tenant_id
- A single query of marts.mart_funnel_daily clearly shows:
  - step counts and conversion rates by day, tenant_id, test_id, locale, channel_key
- visits and unique_visitors are non-zero and stable because page_view exists.
- Unit economics is explainable from tables, with no manual spreadsheet glue.

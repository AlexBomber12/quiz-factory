QUEUE

Purpose
- Execute planned PRs in order, without skipping.
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

4) PR-ANALYTICS-04: BigQuery Bootstrap, PostHog Export Wiring, dbt Scaffold
- Status: DONE
- Tasks file: tasks/PR-ANALYTICS-04.md
- Depends on: PR-ANALYTICS-03

5) PR-ANALYTICS-05: dbt Marts (P&L Daily, Funnel Daily, Unit Econ) + Data Quality
- Status: DONE
- Tasks file: tasks/PR-ANALYTICS-05.md
- Depends on: PR-ANALYTICS-04

6) PR-ANALYTICS-06: Dashboards (P&L Daily, Funnel Daily)
- Status: DONE
- Tasks file: tasks/PR-ANALYTICS-06.md
- Depends on: PR-ANALYTICS-05

7) PR-ANALYTICS-07: Costs, Ad Spend Import (1 channel), Campaign Mapping, and Profit Marts
- Status: DONE
- Tasks file: tasks/PR-ANALYTICS-07.md
- Depends on: PR-ANALYTICS-06

8) PR-ANALYTICS-08: BigQuery EU Location Alignment and dbt Schema Fix
- Status: DONE
- Tasks file: tasks/PR-ANALYTICS-08.md
- Depends on: PR-ANALYTICS-07

9) PR-ANALYTICS-09: Tenant Registry and Locale Resolution
- Status: DONE
- Tasks file: tasks/PR-ANALYTICS-09.md
- Depends on: PR-ANALYTICS-08

10) PR-ANALYTICS-10: Implement page_view
- Status: DONE
- Tasks file: tasks/PR-ANALYTICS-10.md
- Depends on: PR-ANALYTICS-09

11) PR-ANALYTICS-11: Implement analytics/events.json (Full Coverage) + Contract Enforcement
- Status: DONE
- Tasks file: tasks/PR-ANALYTICS-11.md
- Depends on: PR-ANALYTICS-10

12) PR-OPS-POSTHOG-01: Drop IP capture and disable GeoIP enrichment
- Status: DONE
- Tasks file: tasks/PR-OPS-POSTHOG-01.md
- Depends on: PR-ANALYTICS-11

13) PR-ANALYTICS-12: dbt dataset naming fix
- Status: DONE
- Tasks file: tasks/PR-ANALYTICS-12.md
- Depends on: PR-OPS-POSTHOG-01

14) PR-ANALYTICS-13: Remove in-memory session stores
- Status: DONE
- Tasks file: tasks/PR-ANALYTICS-13.md
- Depends on: PR-ANALYTICS-12

15) PR-ANALYTICS-14: Spend attribution hardening
- Status: DONE
- Tasks file: tasks/PR-ANALYTICS-14.md
- Depends on: PR-ANALYTICS-13

16) PR-ANALYTICS-15: Incremental robustness
- Status: DONE
- Tasks file: tasks/PR-ANALYTICS-15.md
- Depends on: PR-ANALYTICS-14

17) PR-ANALYTICS-16: P&L visibility on zero-traffic days
- Status: DONE
- Tasks file: tasks/PR-ANALYTICS-16.md
- Depends on: PR-ANALYTICS-15

18) PR-OPS-POSTHOG-02: Privacy enforcement and access
- Status: DONE
- Tasks file: tasks/PR-OPS-POSTHOG-02.md
- Depends on: PR-ANALYTICS-16

19) PR-ANALYTICS-17: dbt Safety Checks and Cost-only Day Sanity
- Status: DONE
- Tasks file: tasks/PR-ANALYTICS-17.md
- Depends on: PR-OPS-POSTHOG-02
- Outcome:
  - dbt build fails if unexpected datasets or schemas are created
  - sanity checks prevent silent regressions in P&L completeness

20) PR-ANALYTICS-18: Runtime Event Validation and Sanitization
- Status: DONE
- Tasks file: tasks/PR-ANALYTICS-18.md
- Depends on: PR-ANALYTICS-17
- Outcome:
  - all event API routes validate payloads (required fields, forbidden fields)
  - no accidental PII or forbidden keys can enter tracking
  - validation is shared and enforced consistently

21) PR-TENANTS-02: Tenant Provisioning CLI and CI Validation
- Status: DONE
- Tasks file: tasks/PR-TENANTS-02.md
- Depends on: PR-ANALYTICS-18
- Outcome:
  - tenants.json can be generated and validated automatically
  - domains uniqueness and locale correctness are enforced in CI
  - provisioning scales to 200 domains without manual edits

22) PR-OPS-BQ-01: BigQuery Retention and Cost Control Automation
- Status: DONE
- Tasks file: tasks/PR-OPS-BQ-01.md
- Depends on: PR-TENANTS-02
- Outcome:
  - retention policy is codified (SQL and runbook)
  - raw datasets do not grow without bounds
  - changes are safe and reversible

23) PR-ANALYTICS-19: Automated Ad Spend Import (Meta) + Operationalization
- Status: DONE
- Tasks file: tasks/PR-ANALYTICS-19.md
- Depends on: PR-OPS-BQ-01
- Outcome:
  - daily Meta ad spend is imported automatically into raw_costs.ad_spend_daily
  - idempotent merges prevent double counting
  - CSV fallback remains supported

24) PR-SECURITY-01: Edge Rate Limiting and Domain Allowlist
- Status: DONE
- Tasks file: tasks/PR-SECURITY-01.md
- Depends on: PR-OPS-POSTHOG-02
- Outcome:
  - public API routes are rate limited and protected from abuse
  - only known tenant domains can call event endpoints
  - request size limits and method guards are enforced

25) PR-SECURITY-02: Attempt Token and Replay Protection
- Status: DONE
- Tasks file: tasks/PR-SECURITY-02.md
- Depends on: PR-SECURITY-01
- Outcome:
  - attempt-scoped routes require a signed attempt_token
  - replay attempts do not duplicate events

26) PR-ANALYTICS-20: BigQuery Cost Observability and Budget Guardrails
- Status: DONE
- Tasks file: tasks/PR-ANALYTICS-20.md
- Depends on: PR-OPS-POSTHOG-02
- Outcome:
  - daily BigQuery cost table is available
  - budget guardrails and query hygiene are documented

27) PR-ANALYTICS-21: Event Volume Control and High-Cardinality Policy
- Status: DONE
- Tasks file: tasks/PR-ANALYTICS-21.md
- Depends on: PR-ANALYTICS-20
- Outcome:
  - page_view volume is bounded by default
  - high-cardinality fields are sanitized and kept out of marts

28) PR-OPS-POSTHOG-03: PostHog Hardening and Backups
- Status: DONE
- Tasks file: tasks/PR-OPS-POSTHOG-03.md
- Depends on: PR-OPS-POSTHOG-02
- Outcome:
  - PostHog operational runbook exists
  - backup and restore scripts exist

29) PR-OPS-BQ-02: Scheduled Anomaly Checks and Alerts
- Status: DONE
- Tasks file: tasks/PR-OPS-BQ-02.md
- Depends on: PR-ANALYTICS-20
- Outcome:
  - anomaly checks are codified as scheduled query templates
  - alert runbook exists and alerts are stored in marts.alert_events

30) PR-PRODUCT-01: Test Content Format, Registry, and Validation (1 Golden Test EN-ES-PT-BR)
- Status: DONE
- Tasks file: tasks/PR-PRODUCT-01.md
- Depends on: PR-TENANTS-02 and PR-SECURITY-02

31) PR-PRODUCT-02: Tenant Homepage, Test Listing, and Test Landing Pages
- Status: DONE
- Tasks file: tasks/PR-PRODUCT-02.md
- Depends on: PR-PRODUCT-01

32) PR-PRODUCT-03: Test Runner UI and Attempt Entry page_view
- Status: DONE
- Tasks file: tasks/PR-PRODUCT-03.md
- Depends on: PR-PRODUCT-02

33) PR-PRODUCT-04: Server-side Scoring, Result Preview, and Result Cookie
- Status: DONE
- Tasks file: tasks/PR-PRODUCT-04.md
- Depends on: PR-PRODUCT-03

34) PR-PRODUCT-05: Paywall UI and Stripe Checkout Session Creation
- Status: DONE
- Tasks file: tasks/PR-PRODUCT-05.md
- Depends on: PR-PRODUCT-04

35) PR-ANALYTICS-22: Unit Economics Enhancements (Pricing Variants, Packs, Offer Breakdown)
- Status: DONE
- Tasks file: tasks/PR-ANALYTICS-22.md
- Depends on: PR-PRODUCT-05

36) PR-PRODUCT-06: Checkout Success, Entitlement Token, and Paid Report (HTML)
- Status: DONE
- Tasks file: tasks/PR-PRODUCT-06.md
- Depends on: PR-PRODUCT-05

37) PR-PRODUCT-07: Print-Friendly Report and PDF Download Tracking
- Status: DONE
- Tasks file: tasks/PR-PRODUCT-07.md
- Depends on: PR-PRODUCT-06

38) PR-SEO-01: Sitemap, robots.txt, Canonicals, and Basic OG Metadata
- Status: DONE
- Tasks file: tasks/PR-SEO-01.md
- Depends on: PR-PRODUCT-02

39) PR-UI-GOLDEN-01: Golden Template Studio (Golden Landing + Blocks Catalog + Theme Tokens)
- Status: DONE
- Tasks file: tasks/PR-UI-GOLDEN-01.md
- Depends on: PR-PRODUCT-05
- Outcome:
  - internal Template Studio exists (/studio/golden, /studio/blocks)
  - UI blocks and theme tokens are codified for repeatable UI evolution

40) PR-CONTENT-02: Content Factory Tooling (New Test Generator and CSV Import)
- Status: DONE
- Tasks file: tasks/PR-CONTENT-02.md
- Depends on: PR-PRODUCT-01

41) PR-OPS-AUTOMATION-01: Codex Review Auto-Fix + Auto-Merge + Local main Sync
- Status: DONE
- Tasks file: tasks/PR-OPS-AUTOMATION-01.md
- Depends on: none
- Outcome:
  - remove manual waiting/copy-paste for Codex Review feedback
  - enable hands-free merges via auto-merge
  - update local main without Cursor Sync

42) PR-UI-01: Tailwind + shadcn/ui Foundation (Design Tokens, Layout, Primitives)
- Status: DONE
- Tasks file: tasks/PR-UI-01.md
- Depends on: none

43) PR-UI-02: Tenant Homepage (Test List) with Tailwind + shadcn/ui
- Status: DONE
- Tasks file: tasks/PR-UI-02.md
- Depends on: PR-UI-01 and PR-ANALYTICS-09

44) PR-UI-03: Test Landing Page (/t/[slug]) with Tailwind + shadcn/ui
- Status: DONE
- Tasks file: tasks/PR-UI-03.md
- Depends on: PR-UI-02

45) PR-CONTENT-03: Content Add Pipeline (No Attachments) + Values Compass Converter + Universal Template
- Status: DONE
- Tasks file: tasks/PR-CONTENT-03.md
- Depends on: PR-CONTENT-02

46) PR-CONTENT-04: universal_human_v1 Converter + content_add Support (No Attachments)
- Status: DONE
- Tasks file: tasks/PR-CONTENT-04.md
- Depends on: PR-CONTENT-03

47) PR-CONTENT-DB-01: Content DB Schema, Migrations, Local Dev Bootstrap
- Status: DONE
- Tasks file: tasks/PR-CONTENT-DB-01.md
- Depends on: PR-CONTENT-04

48) PR-CONTENT-DB-02: Content Repository API, Caching, and Invalidation Hooks
- Status: DONE
- Tasks file: tasks/PR-CONTENT-DB-02.md
- Depends on: PR-CONTENT-DB-01

49) PR-ADMIN-01: Admin Auth, RBAC Tokens, and Audit Base
- Status: DONE
- Tasks file: tasks/PR-ADMIN-01.md
- Depends on: PR-CONTENT-DB-01

50) PR-ADMIN-02: Upload Bundle (Multi-locale MD) to Imports + Preview
- Status: DONE
- Tasks file: tasks/PR-ADMIN-02.md
- Depends on: PR-ADMIN-01

51) PR-ADMIN-03: Convert Import -> spec_json -> Draft Test Version
- Status: DONE
- Tasks file: tasks/PR-ADMIN-03.md
- Depends on: PR-ADMIN-02

52) PR-ADMIN-04: Publish Workflow (Tenant Mapping) and One-click Rollback
- Status: DONE
- Tasks file: tasks/PR-ADMIN-04.md
- Depends on: PR-ADMIN-03 and PR-CONTENT-DB-02

53) PR-WEB-CONTENT-01: Public Site Loads Content from DB (Feature-flagged FS Fallback)
- Status: DONE
- Tasks file: tasks/PR-WEB-CONTENT-01.md
- Depends on: PR-ADMIN-04

54) PR-MIGRATION-01: One-time Migration from Filesystem Content to DB (Idempotent)
- Status: TODO
- Tasks file: tasks/PR-MIGRATION-01.md
- Depends on: PR-WEB-CONTENT-01

55) PR-SEO-DB-01: Sitemap and Robots Read from DB (With Caching)
- Status: TODO
- Tasks file: tasks/PR-SEO-DB-01.md
- Depends on: PR-WEB-CONTENT-01

56) PR-OPS-CONTENT-01: Content DB Backup/Restore Runbook and Scripts
- Status: TODO
- Tasks file: tasks/PR-OPS-CONTENT-01.md
- Depends on: PR-MIGRATION-01

57) PR-HARDEN-ADMIN-01: Admin Hardening (CSRF, Upload Limits, Staging Publish Safety Rails)
- Status: TODO
- Tasks file: tasks/PR-HARDEN-ADMIN-01.md
- Depends on: PR-ADMIN-04


Execution rules (apply to every PR)
- Work on exactly 1 PR at a time.
- Create a new branch from main named as specified in the selected tasks file (single source of truth).
- Implement only what the tasks file requests.
- Run the project test gate locally before committing.
- Do not commit secrets. Do not add or modify .env except .env.example if the task explicitly says so.
- When green, commit with message "<PR_ID>: <short summary>" and push the branch.

Definition of Done (global)
- A single query of marts.mart_pnl_daily clearly shows:
  - gross, refunds, disputes, fees, ad_spend, content, infra, tools, other, contribution_margin
  - by day and tenant_id
- A single query of marts.mart_funnel_daily clearly shows:
  - step counts and conversion rates by day, tenant_id, test_id, locale, channel_key
- visits and unique_visitors are non-zero and stable because page_view exists.
- Unit economics is explainable from tables, with no manual spreadsheet glue.

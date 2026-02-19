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

20) PR-ANALYTICS-18: Runtime Event Validation and Sanitization
- Status: DONE
- Tasks file: tasks/PR-ANALYTICS-18.md
- Depends on: PR-ANALYTICS-17

21) PR-TENANTS-02: Tenant Provisioning CLI and CI Validation
- Status: DONE
- Tasks file: tasks/PR-TENANTS-02.md
- Depends on: PR-ANALYTICS-18

22) PR-OPS-BQ-01: BigQuery Retention and Cost Control Automation
- Status: DONE
- Tasks file: tasks/PR-OPS-BQ-01.md
- Depends on: PR-TENANTS-02

23) PR-ANALYTICS-19: Automated Ad Spend Import (Meta) + Operationalization
- Status: DONE
- Tasks file: tasks/PR-ANALYTICS-19.md
- Depends on: PR-OPS-BQ-01

24) PR-SECURITY-01: Edge Rate Limiting and Domain Allowlist
- Status: DONE
- Tasks file: tasks/PR-SECURITY-01.md
- Depends on: PR-OPS-POSTHOG-02

25) PR-SECURITY-02: Attempt Token and Replay Protection
- Status: DONE
- Tasks file: tasks/PR-SECURITY-02.md
- Depends on: PR-SECURITY-01

26) PR-ANALYTICS-20: BigQuery Cost Observability and Budget Guardrails
- Status: DONE
- Tasks file: tasks/PR-ANALYTICS-20.md
- Depends on: PR-OPS-POSTHOG-02

27) PR-ANALYTICS-21: Event Volume Control and High-Cardinality Policy
- Status: DONE
- Tasks file: tasks/PR-ANALYTICS-21.md
- Depends on: PR-ANALYTICS-20

28) PR-OPS-POSTHOG-03: PostHog Hardening and Backups
- Status: DONE
- Tasks file: tasks/PR-OPS-POSTHOG-03.md
- Depends on: PR-OPS-POSTHOG-02

29) PR-OPS-BQ-02: Scheduled Anomaly Checks and Alerts
- Status: DONE
- Tasks file: tasks/PR-OPS-BQ-02.md
- Depends on: PR-ANALYTICS-20

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

40) PR-CONTENT-02: Content Factory Tooling (New Test Generator and CSV Import)
- Status: DONE
- Tasks file: tasks/PR-CONTENT-02.md
- Depends on: PR-PRODUCT-01

41) PR-OPS-AUTOMATION-01: Codex Review Auto-Fix + Auto-Merge + Local main Sync
- Status: DONE
- Tasks file: tasks/PR-OPS-AUTOMATION-01.md
- Depends on: none

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
- Status: DONE
- Tasks file: tasks/PR-MIGRATION-01.md
- Depends on: PR-WEB-CONTENT-01

55) PR-SEO-DB-01: Sitemap and Robots Read from DB (With Caching)
- Status: DONE
- Tasks file: tasks/PR-SEO-DB-01.md
- Depends on: PR-WEB-CONTENT-01

56) PR-OPS-CONTENT-01: Content DB Backup/Restore Runbook and Scripts
- Status: DONE
- Tasks file: tasks/PR-OPS-CONTENT-01.md
- Depends on: PR-MIGRATION-01

57) PR-HARDEN-ADMIN-01: Admin Hardening (CSRF, Upload Limits, Staging Publish Safety Rails)
- Status: DONE
- Tasks file: tasks/PR-HARDEN-ADMIN-01.md
- Depends on: PR-ADMIN-04

59) PR-OPS-ARTIFACT-02: Timestamped Artifact Archive Names
- Status: DONE
- Tasks file: tasks/PR-OPS-ARTIFACT-02.md
- Depends on: none

60) PR-HUB-01: Hub Tenant IA (Tests, Categories, Search, Trust Pages, Sitemap)
- Status: DONE
- Tasks file: tasks/PR-HUB-01.md
- Depends on: PR-SEO-DB-01

61) PR-LANDING-01: Selling Test Landing Page (/t/[slug]) Using Studio Blocks
- Status: DONE
- Tasks file: tasks/PR-LANDING-01.md
- Depends on: PR-UI-GOLDEN-01 and PR-UI-03

62) PR-RUNNER-01: Runner Production UX (Likert 5, Progress, Resume, Accessibility)
- Status: DONE
- Tasks file: tasks/PR-RUNNER-01.md
- Depends on: PR-PRODUCT-03 and PR-UI-01

63) PR-LLM-REPORT-01: Report Job Pipeline (Attempt Summary, Jobs Table, Enqueue, Internal Runner)
- Status: DONE
- Tasks file: tasks/PR-LLM-REPORT-01.md
- Depends on: PR-CONTENT-DB-01 and PR-PRODUCT-06

64) PR-LLM-REPORT-02: Report Brief Builder (Deterministic Aggregates for LLM Input)
- Status: DONE
- Tasks file: tasks/PR-LLM-REPORT-02.md
- Depends on: PR-LLM-REPORT-01

65) PR-LLM-REPORT-03: LLM Generator (OpenAI Responses API + Structured Outputs) and Job Processing
- Status: DONE
- Tasks file: tasks/PR-LLM-REPORT-03.md
- Depends on: PR-LLM-REPORT-02

66) PR-LLM-REPORT-04: Auto-Style Mapping (Style Cards + Deterministic Selection)
- Status: DONE
- Tasks file: tasks/PR-LLM-REPORT-04.md
- Depends on: PR-LLM-REPORT-03

67) PR-LLM-REPORT-05: Render LLM Report (API Access, Client Polling, Print Support)
- Status: DONE
- Tasks file: tasks/PR-LLM-REPORT-05.md
- Depends on: PR-LLM-REPORT-04

68) PR-TENANT-FACTORY-01: Tenant Profiles and Niche Presets (Hybrid Hub + Niche)
- Status: DONE
- Tasks file: tasks/PR-TENANT-FACTORY-01.md
- Depends on: PR-HUB-01

69) PR-GROWTH-AB-01: Hub vs Niche Measurement (tenant_kind in events + dbt comparison marts)
- Status: DONE
- Tasks file: tasks/PR-GROWTH-AB-01.md
- Depends on: PR-TENANT-FACTORY-01

70) PR-DOCKER-EXAMPLES-01: Docker Example Templates + Bootstrap Script
- Status: DONE
- Tasks file: tasks/PR-DOCKER-EXAMPLES-01.md
- Depends on: none

71) PR-GHCR-01: Publish Web Image to GHCR + Deploy Compose Template
- Status: DONE
- Tasks file: tasks/PR-GHCR-01.md
- Depends on: PR-DOCKER-EXAMPLES-01

72) PR-UI-04: Calm Premium Theme Contract (Navy + Teal) + Stitch References
- Status: DONE
- Tasks file: tasks/PR-UI-04.md
- Depends on: PR-UI-03 and PR-UI-GOLDEN-01

73) PR-UI-05: Tenant Homepage Calm Premium Refresh (Search + Category Tags)
- Status: DONE
- Tasks file: tasks/PR-UI-05.md
- Depends on: PR-UI-04

74) PR-UI-06: Test Landing Calm Premium Refresh (Sticky CTA + Conversion Layout)
- Status: DONE
- Tasks file: tasks/PR-UI-06.md
- Depends on: PR-UI-04

75) PR-FIX-WEB-METADATA-01: Resilient generateMetadata (no .trim on undefined) for Test Pages
- Status: DONE
- Tasks file: tasks/PR-FIX-WEB-METADATA-01.md
- Depends on: none

76) PR-FIX-ATTEMPT-TOKEN-CONTEXT-01: Attempt token context should not break on host ports (normalize host for tenant resolution)
- Status: DONE
- Tasks file: tasks/PR-FIX-ATTEMPT-TOKEN-CONTEXT-01.md
- Depends on: none

77) PR-E2E-PLAYWRIGHT-SMOKE-01: Playwright E2E Smoke (Start -> Finish, assert /api/test/complete 200)
- Status: DONE
- Tasks file: tasks/PR-E2E-PLAYWRIGHT-SMOKE-01.md
- Depends on: PR-FIX-ATTEMPT-TOKEN-CONTEXT-01

78) PR-UI-07: Primary Ink CTA (Decouple --primary from --color-primary)
- Status: DONE
- Tasks file: tasks/PR-UI-07.md
- Depends on: PR-UI-06 and PR-UI-GOLDEN-01

79) PR-UI-GATE-01: Playwright Visual Regression (Golden Pages Screenshots)
- Status: DONE
- Tasks file: tasks/PR-UI-GATE-01.md
- Depends on: PR-E2E-PLAYWRIGHT-SMOKE-01 and PR-UI-07

80) PR-UI-LANDING-01: Homepage + /tests Product Redesign (Calm Premium)
- Status: DONE
- Tasks file: tasks/PR-UI-LANDING-01.md
- Depends on: PR-UI-GATE-01 and PR-UI-07

81) PR-UI-STITCH-MCP-01: Stitch MCP export + apply annotations to Tenant Home (Standard Grid)
- Status: DONE
- Tasks file: tasks/PR-UI-STITCH-MCP-01.md
- Depends on: PR-UI-LANDING-01 and PR-UI-GATE-01

82) PR-UI-STITCH-HARDEN-01: Stitch hardening (Terracotta accent, no external assets, deterministic)
- Status: DONE
- Tasks file: tasks/PR-UI-STITCH-HARDEN-01.md
- Depends on: PR-UI-STITCH-MCP-01

83) PR-UI-STITCH-TESTS-01: Align /tests with Stitch Tenant Home design
- Status: DONE
- Tasks file: tasks/PR-UI-STITCH-TESTS-01.md
- Depends on: PR-UI-STITCH-HARDEN-01

84) PR-UI-CONTENT-PACK-02: Content packs for small catalogs and empty states
- Status: DONE
- Tasks file: tasks/PR-UI-CONTENT-PACK-02.md
- Depends on: PR-UI-STITCH-TESTS-01

85) PR-UI-FLOW-01: Unify run/preview/pay UI with premium design language
- Status: DONE
- Tasks file: tasks/PR-UI-FLOW-01.md
- Depends on: PR-UI-CONTENT-PACK-02

86) PR-UI-GATE-02: Extend visual suite to flow pages (landing/run/preview/pay)
- Status: DONE
- Tasks file: tasks/PR-UI-GATE-02.md
- Depends on: PR-UI-FLOW-01

87) PR-ADMIN-CONSOLE-01: Admin Layout and Navigation Shell
- Status: DONE
- Tasks file: tasks/PR-ADMIN-CONSOLE-01.md
- Depends on: PR-HARDEN-ADMIN-01 and PR-WEB-CONTENT-01

88) PR-ADMIN-CONSOLE-02: Imports Index (List + Filters)
- Status: DONE
- Tasks file: tasks/PR-ADMIN-CONSOLE-02.md
- Depends on: PR-ADMIN-CONSOLE-01

89) PR-ADMIN-CONSOLE-03: Tests Registry Page (Admin)
- Status: DONE
- Tasks file: tasks/PR-ADMIN-CONSOLE-03.md
- Depends on: PR-ADMIN-CONSOLE-02

90) PR-ADMIN-CONSOLE-04: Test Detail Page (Versions + Publish Status)
- Status: DONE
- Tasks file: tasks/PR-ADMIN-CONSOLE-04.md
- Depends on: PR-ADMIN-CONSOLE-03

91) PR-ADMIN-CONSOLE-05: Tenants Registry + Tenant Detail (Publications)
- Status: DONE
- Tasks file: tasks/PR-ADMIN-CONSOLE-05.md
- Depends on: PR-ADMIN-CONSOLE-04

92) PR-ADMIN-CONSOLE-06: Audit Log Page + Event Instrumentation
- Status: DONE
- Tasks file: tasks/PR-ADMIN-CONSOLE-06.md
- Depends on: PR-ADMIN-CONSOLE-05

93) PR-ADMIN-CONSOLE-07: Admin Guardrails (Diagnostics + Publish Safety)
- Status: DONE
- Tasks file: tasks/PR-ADMIN-CONSOLE-07.md
- Depends on: PR-ADMIN-CONSOLE-06

94) PR-ADMIN-ANALYTICS-01: Analytics UI Skeleton + Global FilterBar
- Status: DONE
- Tasks file: tasks/PR-ADMIN-ANALYTICS-01.md
- Depends on: PR-ADMIN-CONSOLE-07

95) PR-ADMIN-ANALYTICS-02: Admin Analytics API Contract + Provider Abstraction
- Status: DONE
- Tasks file: tasks/PR-ADMIN-ANALYTICS-02.md
- Depends on: PR-ADMIN-ANALYTICS-01

96) PR-ADMIN-ANALYTICS-03: Global Analytics Overview (BigQuery) + UI Wiring
- Status: DONE
- Tasks file: tasks/PR-ADMIN-ANALYTICS-03.md
- Depends on: PR-ADMIN-ANALYTICS-02

97) PR-ADMIN-ANALYTICS-04: Tenants Analytics (List + Detail)
- Status: DONE
- Tasks file: tasks/PR-ADMIN-ANALYTICS-04.md
- Depends on: PR-ADMIN-ANALYTICS-03

98) PR-ADMIN-ANALYTICS-05: Tests Analytics (List + Detail)
- Status: DONE
- Tasks file: tasks/PR-ADMIN-ANALYTICS-05.md
- Depends on: PR-ADMIN-ANALYTICS-04

99) PR-ADMIN-ANALYTICS-06: Distribution Matrix (Tenant x Test) + Quick Metrics
- Status: DONE
- Tasks file: tasks/PR-ADMIN-ANALYTICS-06.md
- Depends on: PR-ADMIN-ANALYTICS-05

100) PR-ADMIN-ANALYTICS-07: Traffic Analytics (UTM, Referrers, Devices, Geo)
- Status: DONE
- Tasks file: tasks/PR-ADMIN-ANALYTICS-07.md
- Depends on: PR-ADMIN-ANALYTICS-06

101) PR-ADMIN-ANALYTICS-08: Revenue + Data Health (Stripe + Freshness)
- Status: DONE
- Tasks file: tasks/PR-ADMIN-ANALYTICS-08.md
- Depends on: PR-ADMIN-ANALYTICS-07

102) PR-ADMIN-CONSOLE-08: Admin UX Finishing (Deep Links)
- Status: DONE
- Tasks file: tasks/PR-ADMIN-CONSOLE-08.md
- Depends on: PR-ADMIN-ANALYTICS-08

103) PR-ADMIN-CONSOLE-09: Publications Registry (Tenant x Test Matrix)
- Status: DONE
- Tasks file: tasks/PR-ADMIN-CONSOLE-09.md
- Depends on: PR-ADMIN-CONSOLE-08

104) PR-CONTENT-DB-03: Analytics Events Store (Content DB)
- Status: DONE
- Tasks file: tasks/PR-CONTENT-DB-03.md
- Depends on: PR-CONTENT-DB-02

105) PR-CONTENT-DB-04: Stripe Facts Store (Content DB)
- Status: DONE
- Tasks file: tasks/PR-CONTENT-DB-04.md
- Depends on: PR-CONTENT-DB-03

106) PR-ADMIN-ANALYTICS-09: Content DB Analytics Provider + Mode Override
- Status: DONE
- Tasks file: tasks/PR-ADMIN-ANALYTICS-09.md
- Depends on: PR-ADMIN-ANALYTICS-08 and PR-CONTENT-DB-04

107) PR-OPS-RUNBOOK-01: Ops Runbook Finishing (standalone, analytics mode, verify)
- Status: DONE
- Tasks file: tasks/PR-OPS-RUNBOOK-01.md
- Depends on: PR-ADMIN-ANALYTICS-09

108) PR-FIX-ADMIN-REDIRECT-01: Fix Admin Redirect Base (avoid 0.0.0.0 after login)
- Status: DONE
- Tasks file: tasks/PR-FIX-ADMIN-REDIRECT-01.md
- Depends on: none

109) PR-DOMAINS-01: DB-backed Domain Registry (Tenants Source of Truth)
- Status: DONE
- Tasks file: tasks/PR-DOMAINS-01.md
- Depends on: PR-ADMIN-CONSOLE-09 and PR-CONTENT-DB-04

110) PR-DOMAINS-02: Universal Domain Publications (Content Registry + Matrix)
- Status: DONE
- Tasks file: tasks/PR-DOMAINS-02.md
- Depends on: PR-DOMAINS-01

111) PR-ADMIN-VIZ-01: Admin Analytics Visualization with Apache ECharts
- Status: DONE
- Tasks file: tasks/PR-ADMIN-VIZ-01.md
- Depends on: PR-ADMIN-ANALYTICS-09 and PR-DOMAINS-01

112) PR-REVENUE-ATTRIB-01: Revenue Attribution (Domain -> Content -> Offer) + Drilldown
- Status: DONE
- Tasks file: tasks/PR-REVENUE-ATTRIB-01.md
- Depends on: PR-ADMIN-VIZ-01

113) PR-TRIGGERS-01: Alerts Rules Engine (Rules, Instances, Runner, UI)
- Status: DONE
- Tasks file: tasks/PR-TRIGGERS-01.md
- Depends on: PR-REVENUE-ATTRIB-01 and PR-DOMAINS-02

114) PR-AI-INSIGHTS-01: AI Insights for Alerts (Action Center)
- Status: DONE
- Tasks file: tasks/PR-AI-INSIGHTS-01.md
- Depends on: PR-TRIGGERS-01

115) PR-PRODUCTS-01: Products Content Type Skeleton + Publish to Domains
- Status: DONE
- Tasks file: tasks/PR-PRODUCTS-01.md
- Depends on: PR-DOMAINS-02

## ============================================================
## TECH DEBT REFACTORING TRACK
## ============================================================

116) PR-REFACTOR-01: TypeScript Path Aliases (@/ imports)
- Status: DONE
- Tasks file: tasks/PR-REFACTOR-01.md
- Depends on: none
- Outcome:
  - all imports deeper than 2 levels use @/ aliases
  - tsconfig paths configured for @/lib, @/components, @/app, @/studio

117) PR-REFACTOR-02: Shared Utility Functions (Deduplicate normalizeString and friends)
- Status: DONE
- Tasks file: tasks/PR-REFACTOR-02.md
- Depends on: PR-REFACTOR-01
- Outcome:
  - zero local normalizeString/parsePositiveInt/parseBoolean definitions
  - shared @/lib/utils module with tests

118) PR-REFACTOR-03: Centralized Environment Variable Validation (zod)
- Status: DONE
- Tasks file: tasks/PR-REFACTOR-03.md
- Depends on: PR-REFACTOR-01
- Outcome:
  - all env vars validated through @/lib/env.ts
  - clear startup error if required vars missing in production
  - .env.example updated with documentation

119) PR-REFACTOR-04: API Route Guards Wrapper (withApiGuards)
- Status: DONE
- Tasks file: tasks/PR-REFACTOR-04.md
- Depends on: PR-REFACTOR-01 and PR-REFACTOR-02
- Outcome:
  - zero manual guard chains in public API routes
  - all public routes use withApiGuards wrapper
  - impossible to forget a guard on new routes

120) PR-REFACTOR-05: Structured Logging (Replace empty catch blocks)
- Status: TODO
- Tasks file: tasks/PR-REFACTOR-05.md
- Depends on: PR-REFACTOR-01 and PR-REFACTOR-03
- Outcome:
  - zero empty catch blocks in production code
  - zero bare console.* calls
  - structured JSON logs in production

121) PR-REFACTOR-06: Tailwind Brand Tokens and UI Component Extraction
- Status: TODO
- Tasks file: tasks/PR-REFACTOR-06.md
- Depends on: PR-REFACTOR-01
- Outcome:
  - brand colors as first-class Tailwind tokens
  - zero raw hsl(var(--brand-*)) patterns
  - FlowFrame, ErrorBanner, ProgressBar as reusable components

122) PR-REFACTOR-07: Unit Tests for Critical UI Flows (Test Runner, Paywall)
- Status: TODO
- Tasks file: tasks/PR-REFACTOR-07.md
- Depends on: PR-REFACTOR-01
- Outcome:
  - TestRunnerClient has 10+ test cases
  - Paywall has 4+ test cases
  - component-level test coverage for critical user flows

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

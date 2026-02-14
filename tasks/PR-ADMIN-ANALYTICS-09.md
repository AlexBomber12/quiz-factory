PR-ADMIN-ANALYTICS-09: Content DB Analytics Provider + Mode Override

Branch name: pr/admin-analytics-09-contentdb

Context
You are working in the Quiz Factory monorepo. Admin Analytics currently uses BigQuery when configured, otherwise a mock provider. This PR adds a Content DB provider so Analytics works in production without BigQuery, using analytics_events + stripe_* tables. Implement only what is listed in this task. Do not ask follow-up questions.

Global constraints
- Do not commit secrets. Do not add or modify .env files.
- Keep changes minimal and scoped to this PR.
- Preserve JSON response shapes of existing /api/admin/analytics/* endpoints.
- Ensure multi-tenant correctness: every query must filter tenant_id when relevant.
- Keep queries efficient; prefer aggregated SQL with indexes.
- If tables are missing, return a stable response with zeros and surface a data health warning.

Implementation tasks
1) Provider selection
- Update lib/admin_analytics/provider.ts:
  - Add a new provider mode: content_db.
  - Add env override ADMIN_ANALYTICS_MODE=bigquery|content_db|mock.
  - Selection rules:
    - If ADMIN_ANALYTICS_MODE is set, honor it (bigquery requires BigQuery env; content_db requires CONTENT_DATABASE_URL; otherwise fallback to mock and document in logs).
    - If not set:
      - bigquery if BigQuery env is configured
      - else content_db if CONTENT_DATABASE_URL is configured
      - else mock
  - Add unit tests for selection logic.

2) Implement Content DB provider
- Add lib/admin_analytics/providers/content_db.ts implementing AdminAnalyticsProvider.
  Data sources:
  - analytics_events (from PR-CONTENT-DB-03)
  - stripe_purchases, stripe_refunds, stripe_disputes, stripe_fees (from PR-CONTENT-DB-04)
  - tenant_tests / tests for publication state (existing)

  Implement:
  - getOverview(filters)
  - getTenants(filters) and getTenantDetail(tenantId, filters)
  - getTests(filters) and getTestDetail(testId, filters)
  - getDistribution(filters, options)
  - getTraffic(filters, options)
  - getRevenue(filters)
  - getDataHealth(filters)

  Metric definitions (minimum viable)
  - sessions: COUNT(DISTINCT session_id) from analytics_events
  - funnel counts from analytics_events.event_name
  - purchases count from stripe_purchases
  - net_revenue_eur: SUM(net_eur) from stripe_fees when present, else SUM(amount_eur) from stripe_purchases
  - refunds/disputes from stripe_refunds/stripe_disputes
  - paid_conversion: purchases / sessions (safe divide)

3) Error handling and defaults
- If analytics_events table is empty, return zeros but do not throw.
- If stripe tables are empty, revenue should be zero but other funnel metrics still work.
- Apply filters consistently:
  - date range start/end
  - optional filters: tenant_id, test_id, locale, device_type, utm_source

4) Tests
- Unit tests for:
  - provider mode selection logic (required)
  - any new pure helpers (safe ratio, filter normalization)

Success criteria
- With only CONTENT_DATABASE_URL configured (no BigQuery env), /admin/analytics pages load with real data from Postgres tables.
- Existing BigQuery mode continues to work unchanged when configured.
- Response shapes remain stable (no frontend changes required).

Local verification (run and report in PR description)
- pnpm --filter @quiz-factory/web lint
- pnpm --filter @quiz-factory/web typecheck
- pnpm --filter @quiz-factory/web test
- pnpm --filter @quiz-factory/web build
- ./scripts/smoke.sh http://localhost:3000

Commit message
PR-ADMIN-ANALYTICS-09: Content DB Analytics Provider + Mode Override

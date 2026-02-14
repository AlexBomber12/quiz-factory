PR-CONTENT-DB-03: Analytics Events Store (Content DB)

Branch name: pr/content-db-03-analytics-events

Context
You are working in the Quiz Factory monorepo. This PR adds a lightweight analytics facts store in the Content DB so we can compute basic operational stats without BigQuery. Implement only what is listed in this task. Do not ask follow-up questions.

Global constraints
- Do not commit secrets. Do not add or modify .env files.
- Keep changes minimal and scoped to this PR.
- Do not change the analytics event contract (analytics/events.json). Reuse validated server-side properties.
- Event recording must be best-effort: failures must not break user-facing endpoints.
- Dedupe must be safe and cheap (use event_id as a unique key).

Implementation tasks
1) Migration: analytics events table
- Add apps/web/src/lib/content_db/migrations/0004_analytics_events.sql
- Create table analytics_events with minimum columns:
  - event_id text PRIMARY KEY
  - event_name text NOT NULL
  - occurred_at timestamptz NOT NULL (use timestamp_utc from event properties)
  - occurred_date date NOT NULL
  - tenant_id text NOT NULL
  - test_id text NULL
  - session_id text NOT NULL
  - distinct_id text NOT NULL
  - locale text NULL
  - device_type text NULL
  - page_type text NULL
  - utm_source text NULL
  - utm_campaign text NULL
  - referrer text NULL
  - country text NULL
- Add indexes:
  - (occurred_date, tenant_id)
  - (occurred_date, tenant_id, test_id)
  - (tenant_id, session_id)

2) Storage library
- Add apps/web/src/lib/analytics/event_store.ts:
  - function recordAnalyticsEventToContentDb(eventName, properties): Promise<void>
  - Use hasContentDatabaseUrl() and return early when not configured.
  - Insert with ON CONFLICT DO NOTHING on event_id.
  - Compute occurred_date from occurred_at in UTC.
  - Only store the subset of fields listed above (do not store full payload JSON).

3) Wire into handleAnalyticsEvent
- In apps/web/src/lib/analytics/server.ts, after payload validation and after dedupe checks:
  - When the event would be emitted (same gating as PostHog emission), also call recordAnalyticsEventToContentDb.
  - Do not await it; call it as fire-and-forget and swallow errors.
  - Ensure page_view respects the existing page_view volume controls.

4) Tests
- Unit tests for the event row mapper:
  - occurred_date derivation
  - null handling for optional fields
  - tenant_id/session_id/distinct_id required behavior
- Keep tests DB-free (mock getContentDbPool or test pure mapping helpers).

Manual verification checklist (include in PR description)
- With CONTENT_DATABASE_URL configured and migrations applied:
  - ./scripts/smoke.sh http://localhost:3000
  - verify at least 2 rows exist in analytics_events after smoke:
    SELECT event_name, COUNT(*) FROM analytics_events GROUP BY event_name ORDER BY event_name;

Local verification (run and report in PR description)
- pnpm --filter @quiz-factory/web lint
- pnpm --filter @quiz-factory/web typecheck
- pnpm --filter @quiz-factory/web test
- pnpm --filter @quiz-factory/web build
- ./scripts/smoke.sh http://localhost:3000

Commit message
PR-CONTENT-DB-03: Analytics Events Store (Content DB)

PR-ANALYTICS-21: Event Volume Control and High-Cardinality Policy

Read and follow AGENTS.md strictly.

Context
- page_view can dominate event volume and drive cost.
- High-cardinality fields (full URLs, referrers, user agents) can inflate storage and query cost.

Goal
- Make page_view economical and stable:
  - Default to 1 page_view per attempt
  - Allow controlled sampling for non-critical page views
- Enforce a policy for high-cardinality fields:
  - keep them out of marts by default
  - sanitize or truncate before storage when needed

Workflow rules
- Create a new branch from main named: pr-analytics-21-event-volume-control
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.

Task A: page_view volume control
A1) Ensure 1 page_view per attempt by default
- Implement a server-side dedup so that for a given session_id:
  - only the first page_view is emitted unless explicitly allowed
- Define a stable page_type for the emitted view (for example: attempt_entry)

A2) Add optional sampling for additional page views
- Add env var PAGE_VIEW_SAMPLE_RATE (default 1.0 for attempt_entry, default 0.1 for any optional extra types)
- Sampling must be deterministic per session_id (so repeated calls behave consistently).

Task B: Sanitize page_url
- If page_url is captured:
  - Store only pathname, no query string
  - Truncate to a safe max length (for example 256 chars)
- Prefer storing page_type instead of page_url for most analysis.

Task C: High-cardinality policy
- Add docs/analytics/event_volume.md defining:
  - which fields are allowed in marts
  - which fields are raw-only
  - recommended max event volume per attempt
- Ensure dbt staging and marts do not include:
  - full referrer URLs
  - full user agent strings
  - full page_url with query strings

Task D: Tests
- Add a unit test for page_view dedup:
  - 2 calls with same session_id should produce only 1 emitted event.
- Add a unit test for page_url sanitization.

Success criteria
- page_view events are limited to 1 per attempt by default.
- page_url is sanitized and never stores query strings.
- docs/analytics/event_volume.md exists.
- dbt marts remain free of high-cardinality fields.

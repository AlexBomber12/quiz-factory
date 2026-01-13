PR-ANALYTICS-13: Remove In-Memory Session Stores for UTM and Click IDs

Read and follow AGENTS.md strictly.

Context
- The server-side analytics currently uses in-memory Maps for session UTM and click ids.
- This is not reliable across multiple instances and can leak memory.
- We already set cookies for distinct_id and session_id.

Goal
- Remove all in-memory session stores for UTM and click ids.
- Use cookies (and request query params on first touch) as the only source of truth.
- Keep behavior deterministic for multi-instance deployments.

Workflow rules
- Create a new branch from main named: pr-analytics-13-no-session-maps
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.

Task A: Delete session Maps
- Remove sessionUtmStore and sessionClickIdStore (or equivalent).
- Remove any getUtmFromSessionStore and getClickIdsFromSessionStore functions.

Task B: Standardize UTM and click id capture
- Define a single function to compute tracking context from a request:
  - First touch: read utm_* and fbclid/gclid/ttclid from URL query params.
  - Persist to cookies (with explicit TTL).
  - Subsequent requests: read from cookies.
- Ensure server-side events always include:
  - utm_source, utm_medium, utm_campaign, utm_content, utm_term when available.
  - fbclid, gclid, ttclid when available.

Task C: Align Stripe metadata
- When creating Stripe checkout or payment intent, include the same utm_* and click ids from cookies.
- Do not rely on any in-memory store.

Task D: Tests
- Add or update tests to cover:
  - First request with UTM in query persists cookies.
  - Subsequent request without query still emits events with the same UTM from cookies.
  - Multi-step analytics-flow test passes without any reliance on in-memory stores.

Success criteria
- No in-memory session stores remain in the codebase.
- UTM and click ids are consistent across the funnel using cookies only.
- Stripe metadata contains UTM and click ids as expected.
- Tests pass locally.

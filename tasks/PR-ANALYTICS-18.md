PR-ANALYTICS-18: Runtime Event Validation and Sanitization

Read and follow AGENTS.md strictly.

Context
- analytics/events.json is the contract and is already enforced for event name parity.
- We want runtime guards so no forbidden keys or accidental PII enters tracking.

Goal
- Add a shared runtime validation layer for all analytics-related API routes and server-side emissions.

Workflow rules
- Create a new branch from main named: pr-analytics-18-runtime-validation
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.

Task A: Shared validation utilities
A1) Add a shared validator module
- Create apps/web/src/lib/analytics/validate.ts (or similar).
- Responsibilities:
  - Validate event name is in the allowed set.
  - Validate required fields are present for the given event.
  - Reject forbidden keys globally (as defined in analytics/events.json forbidden list).
  - Coerce safe types where reasonable (string trim, boolean parsing).
  - Return a clear error object for API 400 responses.

A2) Source of truth for forbidden keys
- Read forbidden keys from analytics/events.json at build time or bundle time.
- Do not duplicate the forbidden keys list in multiple places.

Task B: Apply validation to all event routes
- For every API route that emits events:
  - Validate request payload using the shared validator.
  - If invalid, return 400 with a stable error shape and do not emit PostHog events.

Task C: Validate server-side emissions as well
- Before calling capturePosthogEvent, validate the final event payload.
- This prevents mistakes when fields are added in code without API route involvement.

Task D: Tests
- Add unit tests for:
  - forbidden keys rejection
  - required fields missing rejection
  - allowed minimal payload passes
- Add integration test coverage for at least 2 routes:
  - page_view
  - share_click
- Tests must run in CI.

Success criteria
- All analytics routes reject forbidden keys and missing required fields with HTTP 400.
- Valid payloads still emit correct events.
- Forbidden keys are read from analytics/events.json (single source of truth).
- Tests pass locally and in CI.

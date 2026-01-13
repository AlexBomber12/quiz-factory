PR-OPS-POSTHOG-01: Drop IP capture and disable GeoIP enrichment

Read and follow AGENTS.md strictly.

Context
- Requirement: remove IP data from export and storage if PostHog allows.
- PostHog can:
  - discard client IP data via an instance toggle
  - disable GeoIP enrichment per event using $geoip_disable

Goal
- Ensure server-side events do not get GeoIP enrichment.
- Ensure PostHog is configured to discard client IP data so IP is not stored and does not appear in BigQuery exports as real values.
- Document the required PostHog instance configuration step.

Workflow rules
- Create a new branch from main named: pr-ops-posthog-01-no-ip
- Implement only what this task requests.
- Keep everything in English.
- Avoid using em dashes; use hyphens.

Task A: Disable GeoIP enrichment for server-side events
- Update the server-side PostHog capture payload builder:
  - Always set properties.$geoip_disable = true before sending to /capture.
  - Do not overwrite an explicit value if one is already set.

Task B: Document and verify IP discard in PostHog
- Update docs/analytics/warehouse.md or create docs/analytics/posthog_privacy.md with:
  - The exact PostHog UI setting to enable:
    - Discard client IP data toggle
  - A verification procedure:
    - Capture a test event
    - Confirm in PostHog UI that IP is not shown for the event
    - Confirm BigQuery raw_posthog.events ip column is NULL for new rows (if the column exists)

Task C: BigQuery and dbt expectations
- Ensure dbt staging models never select ip.
- If any docs or queries mention using ip, remove those references.

Success criteria
- All server-side capture payloads include $geoip_disable=true.
- Documentation clearly describes how to enable Discard client IP data and how to verify.
- New events do not store or export real IP values.
- Tests pass locally.

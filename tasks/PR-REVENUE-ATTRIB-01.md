PR-REVENUE-ATTRIB-01: Revenue Attribution (Domain -> Content -> Offer) + Drilldown

Read and follow AGENTS.md strictly.

Context
- The admin is a domains control panel. The key question is “where does money come from”.
- We already have revenue analytics pages, but attribution is not a single, drillable view.

Goal
- Add a BI-style revenue attribution screen with drilldown:
  - Domain -> content (test today) -> offer_key/pricing_variant
  - show gross, net, refunds, disputes, fees (where available)
  - time range support
  - deep links into tenant/test detail pages

Non-goals
- Do not change Stripe integration or event collection in this PR.
- Do not add new payment products/offers in this PR.

Implementation requirements
- API
  - Add new admin analytics endpoint:
    - GET /api/admin/analytics/attribution
    - parameters: date range, tenant_id optional, content_type optional, content_key optional
  - Implement via provider abstraction:
    - BigQuery provider: query marts tables (or existing revenue marts) for grouped attribution
    - Content DB provider: derive from stripe_facts + analytics_events tables
    - Mock provider: deterministic sample output
- UI
  - Add new page /admin/analytics/attribution
  - Visuals (use ECharts components from PR-ADMIN-VIZ-01):
    - stacked bar revenue mix by tenant (or by content) for the selected window
    - table below with sortable columns: tenant, content, offer, gross, net, refunds, conversion
  - Drilldown:
    - click tenant -> filters set tenant_id
    - click content -> filters set content_key
- Safety
  - Ensure no PII is shown (only IDs and aggregate metrics).
- Docs
  - Add a short section in docs/metrics.md or docs/analytics/dashboards.md describing the attribution view.

Workflow rules
- Create a new branch from main named: pr-revenue-attrib-01
- Implement only what this task requests.

Definition of Done
- /admin/analytics/attribution exists and is usable.
- Works with BigQuery provider and Content DB provider (and mock).
- Drilldown works via URL/search params.
- scripts/ci.sh --scope app passes.

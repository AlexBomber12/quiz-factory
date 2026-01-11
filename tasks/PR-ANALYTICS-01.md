Title: PR-ANALYTICS-01 - Metrics spec (single source of truth)

Context
We are building a multi-tenant test network. We must have fully deterministic, auditable metrics and unit economics. Any situation where profit, revenue, or unit economics are unclear is unacceptable.

Workflow rules
- Create a new branch from main named pr-analytics-01-metrics-spec.
- Make only the changes required by this task.
- Do not add secrets. Do not add real API keys. If needed, add placeholders only.
- Keep everything in English.
- Avoid using em dashes; use hyphens.
- When done, commit with message "PR-ANALYTICS-01: metrics spec" and push the branch to origin.

Task A: Repository scaffolding for analytics docs
- Ensure folders exist: docs, tasks, analytics.
- Add a minimal README.md at repo root describing what this repo is (1 paragraph) and pointing to docs/metrics.md as the source of truth.

Task B: Create docs/metrics.md
Create docs/metrics.md as the single source of truth for definitions, formulas, and boundaries.

docs/metrics.md must include these sections, in this exact order, with clear bullet lists and formulas:

1. Purpose
- What this document governs
- Non-goals (explicitly list what is not tracked or not used for decisions)

2. Scope and assumptions
- Currency is EUR only
- Multi-tenant: tenant_id identifies a site (domain + language + country + audience)
- No user accounts; users are anonymous
- Revenue is recognized only from backend payment facts (not from client pixels)

3. Core identifiers
Define each ID, format, and where it is generated:
- tenant_id
- distinct_id (anonymous user id)
- session_id (test attempt id)
- test_id
- purchase_id
- order_id (if different from purchase_id)
- refund_id
- dispute_id

Also define required dimensions for every fact row:
- tenant_id
- test_id
- timestamp_utc
- utm_source
- utm_medium
- utm_campaign
- utm_content
- utm_term
- referrer
- country
- language
- device_type

4. Event contract (high level)
List the required product events and the minimum required properties for each:
- page_view
- test_start
- test_complete
- result_preview_view
- paywall_view
- checkout_start
- purchase_success (backend authoritative)
- purchase_failed
- report_view
- report_pdf_download
- upsell_view
- upsell_accept
- refund_issued (backend authoritative)
- dispute_opened (backend authoritative)
- share_click

Specify:
- purchase_success MUST be emitted server-side after Stripe webhook confirmation
- Each event MUST include tenant_id, session_id, distinct_id, test_id (when applicable), timestamp_utc, and all UTM fields (may be null)

5. Funnel metrics (definitions and formulas)
Define boundaries and formulas:
- Visits
- Unique visitors
- Test starts
- Test completions
- Completion rate = test_complete / test_start
- Paywall rate = paywall_view / test_complete
- Checkout start rate = checkout_start / paywall_view
- Purchase conversion = purchase_success / visits
- Report view rate = report_view / purchase_success

Define boundaries:
- A visit is a browsing session separated by 30 minutes of inactivity
- Exclude internal traffic when property is_internal = true
- All rates must be computable per tenant_id, per test_id, and per channel

6. Financial metrics (definitions and formulas)
Define the canonical finance facts and how they are computed:
- gross_revenue_eur = sum(amount_gross_eur) from successful purchases
- payment_fees_eur = sum(processor_fees_eur) from Stripe balance transaction facts
- refunds_eur = sum(refund_amount_eur) from successful refunds
- disputes_fees_eur = sum(dispute_fee_eur) where applicable
- net_revenue_eur = gross_revenue_eur - payment_fees_eur - refunds_eur - disputes_fees_eur

Define cost buckets:
- ad_spend_eur (per channel per day)
- content_cost_eur (UGC, editing, translation)
- infra_cost_eur (hosting, domains, tools)

Define margins:
- contribution_margin_eur = net_revenue_eur - ad_spend_eur - content_cost_eur - infra_cost_eur

Taxes:
- Define profit_after_tax_model_eur as a model-driven estimate, not a legal truth
- Specify that the tax model is configurable and will be implemented later as a table

7. Unit economics (definitions and formulas)
Define:
- AOV = gross_revenue_eur / purchase_success_count
- profit_per_purchase_eur = contribution_margin_eur / purchase_success_count
- profit_per_visit_eur = contribution_margin_eur / visits
- CAC_eur (channel) = ad_spend_eur / first_time_purchasers_count
- Payback days (if subscription later): define but mark as future

Define cohort LTV windows:
- LTV_7, LTV_30, LTV_90 based on contribution margin per user cohort (distinct_id)

8. Attribution rules
Define a simple, deterministic rule:
- Last non-direct click attribution using UTM fields
- Attribution window = 7 days
- If no UTM, classify as direct, organic, or referral based on referrer

9. Data quality rules and reconciliation
Define:
- Deduplication rules (event_id if available; otherwise distinct tuple of event + timestamp + session_id)
- Required fields must be non-null for backend facts (purchase, refund, dispute)
- Daily reconciliation checks:
  - purchases_count in Stripe facts matches purchase_success events within tolerance
  - gross_revenue_eur matches Stripe totals within tolerance
- Alert thresholds (examples):
  - purchase conversion drops by 30% day-over-day
  - refund rate exceeds 5%
  - missing Stripe webhook ingestion for 30 minutes

10. Privacy and retention
Define:
- Do not store raw free-text answers unless explicitly required
- Prefer storing only derived scores per scale

Retention defaults (example):
- raw events retained 18 months
- finance facts retained 7 years (accounting needs)

State that sensitive categories (politics, health) are high risk and require explicit design decisions.

11. Change control
Define:
- Changes require PR
- Every change must include:
  - the new definition
  - effective date
  - backward compatibility notes

Task C: Add analytics/events.json skeleton
Create analytics/events.json that lists all events and required properties as a machine-readable contract.
Keep it simple:
- An object with event names as keys
- For each event: required_properties array, optional_properties array
Do not add code, only the schema file.

Task D: Add AGENTS.md for future Codex runs
Create AGENTS.md at repo root that states:
- Always use tasks/PR-*.md workflow
- Branch naming convention pr-<area>-<id>-<slug>
- No secrets
- All definitions are governed by docs/metrics.md

Success criteria
- docs/metrics.md exists and includes all 11 sections above with clear formulas and explicit boundaries.
- analytics/events.json exists and includes all events listed.
- README.md and AGENTS.md exist.
- The branch pr-analytics-01-metrics-spec is pushed to origin with a single commit "PR-ANALYTICS-01: metrics spec".

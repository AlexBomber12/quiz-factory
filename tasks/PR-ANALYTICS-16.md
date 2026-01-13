PR-ANALYTICS-16: P&L Visibility on Zero-Traffic Days

Read and follow AGENTS.md strictly.

Context
- mart_pnl_daily is currently keyed primarily by funnel and purchase-derived keys.
- On days with costs but no page_view or purchases, P&L rows may be missing.
- Shared costs allocation can divide by zero if visits are 0.

Goal
- Ensure P&L shows costs and contribution margin even when traffic is 0.
- Make cost allocation deterministic and safe when visits are 0.

Workflow rules
- Create a new branch from main named: pr-analytics-16-zero-traffic-pnl
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.

Task A: Expand mart_pnl_daily key space
- Update marts.mart_pnl_daily to build all_keys as a UNION of keys from:
  - funnel (mart_funnel_daily)
  - purchases (stripe facts)
  - mapped spend (mart_spend_mapped_daily)
  - costs_daily (direct costs)
- Ensure date is always present.

Task B: Safe allocation when visits are 0
- For shared costs allocation proportional to visits:
  - If total visits for the day is 0, allocate shared costs to a special tenant_id value:
    - tenant_id = "__unallocated__"
  - Do not drop the cost.
- Document this behavior in docs/analytics/cost_allocation.md.

Task C: Ensure negative days appear
- Ensure mart_pnl_daily includes rows where:
  - gross_revenue_eur = 0
  - total_costs_eur > 0
  - contribution_margin_eur < 0

Task D: Data quality
- Add a dbt test or sanity model that lists days where:
  - total_costs_eur > 0
  - but there is no row in mart_pnl_daily
- This should be empty after the change.

Success criteria
- mart_pnl_daily shows cost-only days and negative contribution margin days.
- Shared costs are not lost when visits are 0 and are assigned to __unallocated__.
- docs/analytics/cost_allocation.md documents the fallback.
- dbt build and tests pass.

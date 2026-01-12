PR-ANALYTICS-07: Costs, Ad Spend Import (1 channel), Campaign Mapping, and Profit Marts (Revised)

Read and follow AGENTS.md strictly.

Context
- We already have marts for funnel and net revenue.
- This PR turns net revenue into contribution margin by adding costs and ad spend.

Goal
- Turn net revenue into contribution margin and CAC using deterministic joins:
  - Ad spend imported daily.
  - Spend mapped to utm_campaign using campaign_map.
  - Shared costs allocated deterministically.
- Update marts so P&L daily shows profit, not only revenue.

Workflow rules
- Create a new branch from main named: pr-analytics-07-costs-and-spend
- Implement only what this task requests.
- Keep everything in English.
- Avoid using em dashes; use hyphens.

Task A: Costs and spend data loading (CSV-first must work)
A1) CSV importer
- Implement CSV ingestion for:
  - raw_costs.costs_daily
  - raw_costs.ad_spend_daily
  - raw_costs.campaign_map
- Idempotency:
  - Re-importing the same file must not double count.
  - Use a deterministic merge key per table:
    - costs_daily: (date, cost_type, tenant_id, locale, notes)
    - ad_spend_daily: (date, platform, account_id, campaign_id)
    - campaign_map: (platform, account_id, campaign_id, valid_from)

A2) Optional API stub
- You may add a Meta API fetcher stub behind env vars, but CSV path must work end-to-end and is required.

Task B: Campaign mapping logic (no naive utm joins)
- In dbt, build a mapped spend staging model:
  - For each spend row, resolve utm_campaign via campaign_map where:
    - platform and account_id match
    - campaign_id matches
    - date is within [valid_from, valid_to] (valid_to nullable means open-ended)
- If mapping is missing, fallback to the spend row utm_campaign field if present.
- Create marts.mart_spend_mapped_daily with:
  - date, platform, utm_campaign, amount_eur, impressions, clicks

Task C: Cost allocation rules (deterministic, documented)
- Define a default allocation for shared costs (infra/tools) to tenants:
  - proportional to visits per tenant per day (from mart_funnel_daily)
- Costs that already have tenant_id set are direct-allocated and must not be redistributed.
- Document allocation rules in docs/analytics/cost_allocation.md.

Task D: Update marts to include profit
D1) Update marts.mart_pnl_daily
- Add:
  - ad_spend_eur
  - content_cost_eur
  - infra_cost_eur
  - tools_cost_eur
  - other_cost_eur
  - contribution_margin_eur
- Spend join:
  - by date and utm_campaign (through channel_key resolution)
- Costs join:
  - direct allocations by tenant_id
  - shared allocations by the rule above

D2) Update marts.mart_unit_econ_daily
- Add:
  - profit_per_purchase_eur
  - profit_per_visit_eur
  - CAC_eur = ad_spend_eur / first_time_purchasers_count
- Define first_time_purchasers_count using distinct_id:
  - first purchase date per distinct_id, counted when date equals first purchase date

Task E: Data quality
- Add dbt tests:
  - spend_mapped_daily unique by (date, platform, utm_campaign)
  - contribution_margin_eur not null where net_revenue_eur exists
- Add a sanity check model:
  - Total contribution margin by day equals net revenue minus total costs for that day (within rounding).

Success criteria
- With sample CSVs, ad spend and costs appear in mart_pnl_daily and contribution_margin_eur is computed.
- CAC_eur is computed deterministically and uses distinct_id first purchase logic.
- campaign_map is used for mapping spend to utm_campaign, not only raw utm strings.
- Pipeline is idempotent for repeated imports.
- dbt tests pass.

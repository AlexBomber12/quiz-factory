PR-ANALYTICS-07: Costs and Ad Spend Import (1 channel) + P&L Join

Goal
- Turn net revenue into profit by incorporating costs, at least ad spend from 1 channel.

Changes
- Add BigQuery schema for:
  - raw_costs.costs_daily (date, cost_type: infra/content/tools/other, amount_eur, tenant_id nullable, locale nullable, notes)
  - raw_costs.ad_spend_daily (date, platform, account_id, campaign_id, campaign_name, utm_campaign, amount_eur, impressions, clicks)
- Implement importer:
  - Start with CSV ingestion script for ad spend and costs (deterministic and easy)
  - Optional: add a Meta API fetcher stub behind env vars, but CSV path must work end-to-end
- Update dbt marts:
  - Join ad_spend_daily into mart_pnl_daily by date and utm_campaign
  - Subtract costs to produce contribution_margin_eur
  - Update mart_unit_econ_daily with CAC = ad_spend / first_time_purchasers

Success criteria
- With a sample CSV, mart_pnl_daily shows ad_spend_eur and contribution_margin_eur.
- Profit per purchase and profit per visitor are non-null where data exists.
- The pipeline remains idempotent (re-import does not double count).

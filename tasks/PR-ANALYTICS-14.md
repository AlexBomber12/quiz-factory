PR-ANALYTICS-14: Spend Attribution Hardening (No utm_campaign Collisions)

Read and follow AGENTS.md strictly.

Context
- Ad spend is mapped to utm_campaign using campaign_map.
- mart_pnl_daily currently joins spend using utm_campaign only.
- This is unsafe because the same utm_campaign can exist across platforms (meta and tiktok).

Goal
- Join spend to revenue using a collision-safe key.
- Preserve platform or utm_source in the spend join.
- Make the join deterministic and auditable.

Workflow rules
- Create a new branch from main named: pr-analytics-14-spend-join
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.

Task A: Normalize source identifiers
- Define a normalization rule for sources:
  - platform values in raw_costs.ad_spend_daily (meta, tiktok) must map to canonical utm_source values.
  - If your tracking uses facebook or instagram, normalize those to meta.
- Implement normalization consistently in dbt staging for both events and spend.

Task B: Produce a spend fact keyed by (utm_source, utm_campaign)
- Update marts.mart_spend_mapped_daily to include:
  - date
  - utm_source
  - utm_campaign
  - platform
  - amount_eur, impressions, clicks
- Ensure utm_source is the canonical key used in events.

Task C: Join spend into mart_pnl_daily using the safe key
- Update marts.mart_pnl_daily spend join to use:
  - date
  - utm_source
  - utm_campaign
- If channel_key is used, ensure you can reliably extract utm_source and utm_campaign from it.

Task D: Data quality
- Add a dbt test to ensure spend rows are unique per:
  - (date, utm_source, utm_campaign)
- Add a sanity check model that reports collisions where:
  - the same utm_campaign appears under multiple utm_source values on the same date.

Success criteria
- Ad spend joins into mart_pnl_daily without collisions across platforms.
- mart_spend_mapped_daily includes utm_source and platform.
- dbt tests pass.
- A collision report exists and is usually empty in normal operation.

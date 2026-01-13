PR-ANALYTICS-15: Incremental Robustness (Same-Day Updates and Late Events)

Read and follow AGENTS.md strictly.

Context
- Several dbt models use incremental filters like date > max(date).
- This fails for same-day re-imports (CSV updated) and late-arriving events.

Goal
- Make incremental models robust to:
  - same-day updates for spend and costs
  - late events and webhooks
- Keep BigQuery cost low by using a small lookback window.

Workflow rules
- Create a new branch from main named: pr-analytics-15-incremental-lookback
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.

Task A: Add a configurable lookback window
- Add a dbt variable incremental_lookback_days with default 2.

Task B: Apply lookback to incremental staging models
- For spend and costs staging models:
  - use date >= (max(date) - incremental_lookback_days)
- For events staging models:
  - use timestamp_utc >= (max(timestamp_utc) - incremental_lookback_days)

Task C: Apply lookback to marts where needed
- For marts that aggregate by date, ensure the incremental filter covers at least the lookback window.

Task D: Add a regression test approach
- Add a docs note or a small test fixture that demonstrates:
  - Import spend for today, run dbt, note totals.
  - Re-import corrected spend for the same day, rerun dbt, totals update.
- If a scripted test exists in repo, implement it as an automated test.

Success criteria
- Re-importing spend CSV for the same day updates marts within the lookback window.
- Late events within the lookback window are reflected in marts.
- BigQuery scan cost remains bounded.
- dbt build and tests pass.

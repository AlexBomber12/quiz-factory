# Cost allocation

## Inputs
- raw_costs.costs_daily
- marts.mart_funnel_daily (visits)

## Rules
1) Direct costs
- If tenant_id is set, the cost is allocated only to that tenant and date.
- If locale is set, allocation is limited to that locale.
- Direct costs are distributed across the tenant channel rows by visit share so the grain matches mart_pnl_daily.
- If the tenant has no visits for the day, the cost is assigned to channel_key "__unallocated__" with test_id "__unallocated__". Locale uses the cost locale or "__unallocated__".

2) Shared costs
- Shared costs are infra and tools rows with tenant_id null.
- Shared costs are allocated by visit share across all tenants per day using mart_funnel_daily visits.
- Allocation is distributed across each tenant channel row by visit share.
- If total visits for the day are 0, shared costs are assigned to tenant_id "__unallocated__" with test_id, locale, and channel_key set to "__unallocated__".

3) Other cost types
- Content and other costs are expected to have tenant_id set and are not reallocated across tenants.

## Notes
- Allocation uses visit counts from mart_funnel_daily.
- The allocation is deterministic and stable for the same input data.

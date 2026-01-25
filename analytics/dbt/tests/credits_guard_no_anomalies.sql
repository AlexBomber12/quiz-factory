{% set lookback_days = var("credits_guard_lookback_days") %}

select
  date,
  tenant_id,
  credits_granted_lookback_total,
  credits_consumed_lookback_total,
  credits_over_consumed_lookback
from {{ ref('mart_credits_reconciliation_daily') }}
where has_credits_anomaly
  and date >= date_sub(
    current_date('{{ var("reporting_timezone") }}'),
    interval {{ lookback_days }} day
  )

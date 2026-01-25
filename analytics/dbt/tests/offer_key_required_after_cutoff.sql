{% set cutoff_date = var("offer_key_required_cutoff_date") %}

select
  purchase_id,
  tenant_id,
  created_utc,
  offer_key
from {{ ref('stg_stripe_purchases') }}
where date(created_utc, '{{ var("reporting_timezone") }}') >= date('{{ cutoff_date }}')
  and (offer_key is null or nullif(trim(offer_key), '') is null)

{{
  config(
    materialized='incremental',
    unique_key=['date', 'platform', 'utm_campaign'],
    partition_by={'field': 'date', 'data_type': 'date'},
    cluster_by=['platform', 'utm_campaign']
  )
}}

{% set incremental_date %}
(select coalesce(max(date), date('1900-01-01')) from {{ this }})
{% endset %}

with mapped as (
  select
    date,
    platform,
    utm_campaign,
    amount_eur,
    impressions,
    clicks
  from {{ ref('stg_spend_mapped_daily') }}
  {% if is_incremental() %}
    where date > {{ incremental_date }}
  {% endif %}
)

select
  date,
  platform,
  utm_campaign,
  sum(amount_eur) as amount_eur,
  sum(impressions) as impressions,
  sum(clicks) as clicks
from mapped
group by date, platform, utm_campaign

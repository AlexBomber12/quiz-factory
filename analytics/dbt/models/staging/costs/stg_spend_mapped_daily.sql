{{
  config(
    materialized='view'
  )
}}

with spend as (
  select
    date,
    platform,
    account_id,
    campaign_id,
    campaign_name,
    nullif(trim(utm_campaign), '') as utm_campaign,
    amount_eur,
    impressions,
    clicks
  from {{ ref('stg_ad_spend_daily') }}
),

campaign_map as (
  select
    platform,
    account_id,
    campaign_id,
    nullif(trim(utm_campaign), '') as utm_campaign,
    valid_from,
    valid_to
  from {{ ref('stg_campaign_map') }}
),

mapped as (
  select
    s.date,
    s.platform,
    s.account_id,
    s.campaign_id,
    s.campaign_name,
    coalesce(m.utm_campaign, s.utm_campaign) as utm_campaign,
    s.amount_eur,
    s.impressions,
    s.clicks
  from spend s
  left join campaign_map m
    on s.platform = m.platform
    and s.account_id = m.account_id
    and s.campaign_id = m.campaign_id
    and s.date >= m.valid_from
    and (m.valid_to is null or s.date <= m.valid_to)
  qualify row_number() over (
    partition by s.date, s.platform, s.account_id, s.campaign_id
    order by m.valid_from desc
  ) = 1
)

select
  date,
  platform,
  account_id,
  campaign_id,
  campaign_name,
  lower(utm_campaign) as utm_campaign,
  amount_eur,
  impressions,
  clicks
from mapped

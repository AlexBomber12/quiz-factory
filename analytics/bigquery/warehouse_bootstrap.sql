-- BigQuery bootstrap for analytics datasets and core tables.

CREATE SCHEMA IF NOT EXISTS raw_posthog OPTIONS(location = "EU");
CREATE SCHEMA IF NOT EXISTS raw_costs OPTIONS(location = "EU");
CREATE SCHEMA IF NOT EXISTS marts OPTIONS(location = "EU");
CREATE SCHEMA IF NOT EXISTS tmp OPTIONS(location = "EU");

CREATE TABLE IF NOT EXISTS raw_posthog.events (
  uuid STRING,
  event STRING,
  properties JSON,
  elements STRING,
  set JSON,
  set_once JSON,
  distinct_id STRING,
  team_id INT64,
  ip STRING,
  site_url STRING,
  timestamp TIMESTAMP,
  bq_ingested_timestamp TIMESTAMP
)
PARTITION BY DATE(timestamp)
CLUSTER BY event, distinct_id;

CREATE TABLE IF NOT EXISTS raw_costs.costs_daily (
  date DATE,
  cost_type STRING,
  amount_eur NUMERIC,
  tenant_id STRING,
  locale STRING,
  notes STRING
)
PARTITION BY date
CLUSTER BY cost_type, tenant_id;

CREATE TABLE IF NOT EXISTS raw_costs.ad_spend_daily (
  date DATE,
  platform STRING,
  account_id STRING,
  campaign_id STRING,
  campaign_name STRING,
  utm_campaign STRING,
  amount_eur NUMERIC,
  impressions INT64,
  clicks INT64
)
PARTITION BY date
CLUSTER BY platform, account_id;

CREATE TABLE IF NOT EXISTS raw_costs.campaign_map (
  platform STRING,
  account_id STRING,
  campaign_id STRING,
  utm_campaign STRING,
  valid_from DATE,
  valid_to DATE,
  notes STRING
)
PARTITION BY valid_from
CLUSTER BY platform, account_id, campaign_id;

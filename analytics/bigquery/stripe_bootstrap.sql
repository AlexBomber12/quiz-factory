CREATE SCHEMA IF NOT EXISTS raw_stripe OPTIONS(location = "EU");
CREATE SCHEMA IF NOT EXISTS tmp OPTIONS(location = "EU");

CREATE TABLE IF NOT EXISTS raw_stripe.webhook_events_min (
  stripe_event_id STRING,
  type STRING,
  created_utc TIMESTAMP,
  livemode BOOL,
  object_type STRING,
  object_id STRING,
  request_id STRING,
  api_version STRING,
  received_utc TIMESTAMP
)
PARTITION BY DATE(created_utc)
CLUSTER BY stripe_event_id;

CREATE TABLE IF NOT EXISTS raw_stripe.purchases (
  purchase_id STRING,
  provider STRING,
  created_utc TIMESTAMP,
  amount_eur NUMERIC,
  currency STRING,
  status STRING,
  offer_key STRING,
  product_type STRING,
  pricing_variant STRING,
  credits_granted INT64,
  unit_price_eur NUMERIC,
  is_upsell BOOL,
  tenant_id STRING,
  test_id STRING,
  session_id STRING,
  distinct_id STRING,
  locale STRING,
  utm_source STRING,
  utm_medium STRING,
  utm_campaign STRING,
  utm_content STRING,
  utm_term STRING,
  fbclid STRING,
  gclid STRING,
  ttclid STRING,
  stripe_customer_id STRING,
  stripe_payment_intent_id STRING
)
PARTITION BY DATE(created_utc)
CLUSTER BY purchase_id;

CREATE TABLE IF NOT EXISTS raw_stripe.refunds (
  refund_id STRING,
  purchase_id STRING,
  created_utc TIMESTAMP,
  amount_eur NUMERIC,
  status STRING
)
PARTITION BY DATE(created_utc)
CLUSTER BY refund_id;

CREATE TABLE IF NOT EXISTS raw_stripe.disputes (
  dispute_id STRING,
  purchase_id STRING,
  created_utc TIMESTAMP,
  amount_eur NUMERIC,
  status STRING
)
PARTITION BY DATE(created_utc)
CLUSTER BY dispute_id;

CREATE TABLE IF NOT EXISTS raw_stripe.fees (
  purchase_id STRING,
  balance_transaction_id STRING,
  created_utc TIMESTAMP,
  fee_eur NUMERIC,
  net_eur NUMERIC
)
PARTITION BY DATE(created_utc)
CLUSTER BY balance_transaction_id;

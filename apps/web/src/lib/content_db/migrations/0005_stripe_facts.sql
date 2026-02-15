CREATE TABLE IF NOT EXISTS stripe_webhook_events_min (
  stripe_event_id text PRIMARY KEY,
  type text NOT NULL,
  created_utc timestamptz NOT NULL,
  livemode boolean NOT NULL,
  object_type text,
  object_id text,
  request_id text,
  api_version text,
  received_utc timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS stripe_purchases (
  purchase_id text PRIMARY KEY,
  provider text NOT NULL,
  created_utc timestamptz NOT NULL,
  amount_eur numeric(12, 2),
  currency text,
  status text,
  offer_key text,
  product_type text,
  pricing_variant text,
  credits_granted integer,
  unit_price_eur numeric(12, 2),
  is_upsell boolean,
  tenant_id text,
  test_id text,
  session_id text,
  distinct_id text,
  locale text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  fbclid text,
  gclid text,
  ttclid text,
  stripe_customer_id text,
  stripe_payment_intent_id text
);

CREATE TABLE IF NOT EXISTS stripe_refunds (
  refund_id text PRIMARY KEY,
  purchase_id text,
  created_utc timestamptz NOT NULL,
  amount_eur numeric(12, 2),
  status text
);

CREATE TABLE IF NOT EXISTS stripe_disputes (
  dispute_id text PRIMARY KEY,
  purchase_id text,
  created_utc timestamptz NOT NULL,
  amount_eur numeric(12, 2),
  status text
);

CREATE TABLE IF NOT EXISTS stripe_fees (
  balance_transaction_id text PRIMARY KEY,
  purchase_id text,
  created_utc timestamptz NOT NULL,
  fee_eur numeric(12, 2),
  net_eur numeric(12, 2)
);

CREATE INDEX IF NOT EXISTS idx_stripe_purchases_created_utc
  ON stripe_purchases (created_utc);

CREATE INDEX IF NOT EXISTS idx_stripe_purchases_tenant_created_utc
  ON stripe_purchases (tenant_id, created_utc);

CREATE INDEX IF NOT EXISTS idx_stripe_purchases_test_created_utc
  ON stripe_purchases (test_id, created_utc);

CREATE INDEX IF NOT EXISTS idx_stripe_refunds_created_utc
  ON stripe_refunds (created_utc);

CREATE INDEX IF NOT EXISTS idx_stripe_disputes_created_utc
  ON stripe_disputes (created_utc);

CREATE INDEX IF NOT EXISTS idx_stripe_fees_created_utc
  ON stripe_fees (created_utc);

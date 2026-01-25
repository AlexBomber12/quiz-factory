ALTER TABLE raw_stripe.purchases ADD COLUMN IF NOT EXISTS offer_key STRING;
ALTER TABLE raw_stripe.purchases ADD COLUMN IF NOT EXISTS product_type STRING;
ALTER TABLE raw_stripe.purchases ADD COLUMN IF NOT EXISTS pricing_variant STRING;
ALTER TABLE raw_stripe.purchases ADD COLUMN IF NOT EXISTS credits_granted INT64;
ALTER TABLE raw_stripe.purchases ADD COLUMN IF NOT EXISTS unit_price_eur NUMERIC;

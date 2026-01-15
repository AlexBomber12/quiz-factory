-- Set partition expiration for partitioned raw datasets.
-- Run with standard SQL enabled.

ALTER TABLE `raw_posthog.events`
SET OPTIONS (
  partition_expiration_days = 90
);

ALTER TABLE `raw_stripe.webhook_events_min`
SET OPTIONS (
  partition_expiration_days = 180
);

ALTER TABLE `raw_stripe.purchases`
SET OPTIONS (
  partition_expiration_days = 180
);

ALTER TABLE `raw_stripe.refunds`
SET OPTIONS (
  partition_expiration_days = 180
);

ALTER TABLE `raw_stripe.disputes`
SET OPTIONS (
  partition_expiration_days = 180
);

ALTER TABLE `raw_stripe.fees`
SET OPTIONS (
  partition_expiration_days = 180
);

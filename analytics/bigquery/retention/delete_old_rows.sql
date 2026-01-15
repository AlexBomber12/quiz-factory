-- Delete data older than a cutoff date for tables where partition expiration is not available.
-- This script is safe by default and requires an explicit cutoff_date.

DECLARE cutoff_date DATE DEFAULT NULL;
ASSERT cutoff_date IS NOT NULL AS 'Set cutoff_date to DATE "YYYY-MM-DD" before running.';

-- Fallback deletes for raw_posthog and raw_stripe tables.
DELETE FROM `raw_posthog.events`
WHERE DATE(timestamp) < cutoff_date;

DELETE FROM `raw_stripe.webhook_events_min`
WHERE DATE(created_utc) < cutoff_date;

DELETE FROM `raw_stripe.purchases`
WHERE DATE(created_utc) < cutoff_date;

DELETE FROM `raw_stripe.refunds`
WHERE DATE(created_utc) < cutoff_date;

DELETE FROM `raw_stripe.disputes`
WHERE DATE(created_utc) < cutoff_date;

DELETE FROM `raw_stripe.fees`
WHERE DATE(created_utc) < cutoff_date;

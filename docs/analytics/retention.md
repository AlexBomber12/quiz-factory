# Analytics Retention Policy

## Scope
This policy covers BigQuery analytics datasets in EU. Metric definitions remain governed by `docs/metrics.md`.

## Retention windows
- raw_posthog: 90 days
- raw_stripe: 180 days
- raw_costs: keep indefinitely
- marts: keep indefinitely

## Rationale
- raw_posthog is high volume and sourced from PostHog exports, so shorter retention controls storage growth.
- raw_stripe supports finance review and chargebacks, and 180 days balances operational needs and cost.
- raw_costs is low volume and business critical for finance accuracy, so keep it indefinitely.
- marts are curated outputs with low storage impact, so keep them indefinitely.

## Expected BigQuery cost impact
- Partition expiration limits long-term storage growth in raw datasets.
- Shorter raw retention reduces bytes scanned for wide time range queries.
- Keeping raw_costs and marts indefinitely preserves finance history without a large storage footprint.

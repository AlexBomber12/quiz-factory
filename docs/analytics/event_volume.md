# Event volume and high-cardinality policy

## Purpose
- Keep analytics event volume predictable and cost-aware.
- Prevent high-cardinality fields from inflating storage and query cost.
- Align with the metric definitions in `docs/metrics.md`.

## Page view volume
- Default page_view type is `attempt_entry`.
- Emit only the first page_view per session_id by default.
- Optional extra page_view types must be explicit and are sampled.
- Sampling is deterministic per session_id.
- `PAGE_VIEW_SAMPLE_RATE` applies to optional page_view types and defaults to 0.1.
- `attempt_entry` page_view is always 1.0 sampling.

Recommended max event volume per attempt:
- Target 12 or fewer total events per attempt.
- Keep page_view to 1 primary event, and sample optional page_view types at 10 percent or less.

## High-cardinality field policy
Allowed in marts:
- tenant_id, test_id, session_id, distinct_id, event_name, timestamp_utc
- locale, country, language, device_type
- utm_source, utm_medium, utm_campaign, utm_content, utm_term
- referrer host only, no full URL
- page_type
- purchase_id, amount_eur, product_type, payment_provider, is_upsell, refund_id, dispute_id
- share_target

Raw-only fields:
- full page_url or any URL with query strings
- full referrer URLs
- full user agent strings
- click ids (fbclid, gclid, ttclid)

Notes:
- page_url is stored as pathname only, with query strings removed and length capped.
- Prefer page_type for analysis instead of page_url.

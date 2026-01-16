# Request guards

This document describes the guards applied to public API routes under
`apps/web/src/app/api`.

## What is enforced

- Method allowlist per route.
- Host allowlist using tenant domains from `config/tenants.json`.
- Origin allowlist when the `Origin` header is present.
- Rate limiting keyed by the `qf_distinct_id` cookie when present, with a
  hashed `X-Forwarded-For` fallback.
- JSON body size limits on analytics event routes.

Stripe webhooks only enforce method and content type checks. Tenant allowlists
are not applied to webhook routes.

## Default limits per route

All analytics event routes share the same defaults unless overridden by
environment variables.

| Route | Methods | Max body size | Rate limit default |
| --- | --- | --- | --- |
| `/api/page/view` | POST | 32 KB | 60 requests per 60 seconds |
| `/api/share/click` | POST | 32 KB | 60 requests per 60 seconds |
| `/api/test/start` | POST | 32 KB | 60 requests per 60 seconds |
| `/api/test/complete` | POST | 32 KB | 60 requests per 60 seconds |
| `/api/paywall/view` | POST | 32 KB | 60 requests per 60 seconds |
| `/api/checkout/start` | POST | 32 KB | 60 requests per 60 seconds |
| `/api/upsell/view` | POST | 32 KB | 60 requests per 60 seconds |
| `/api/upsell/accept` | POST | 32 KB | 60 requests per 60 seconds |
| `/api/report/view` | POST | 32 KB | 60 requests per 60 seconds |
| `/api/report/pdf` | POST | 32 KB | 60 requests per 60 seconds |
| `/api/result/preview` | POST | 32 KB | 60 requests per 60 seconds |

## Rate limit configuration

- `RATE_LIMIT_ENABLED` controls whether rate limiting is active. Default is true.
- `RATE_LIMIT_SALT` is required in production and is used to hash IP addresses.
- `RATE_LIMIT_WINDOW_SECONDS` overrides the window length.
- `RATE_LIMIT_MAX_REQUESTS` overrides the maximum allowed requests per window.

If `RATE_LIMIT_SALT` is not set in non-production environments, a fallback salt
is used for local development and tests.

## Reverse proxy guidance

- Forward `Host`, `Origin`, `X-Forwarded-Host`, and `X-Forwarded-For`.
- Ensure `X-Forwarded-For` is set by a trusted proxy and not by the client.
- Preserve the original host so tenant allowlists resolve correctly.

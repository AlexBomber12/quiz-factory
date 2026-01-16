PR-SECURITY-01: Edge Rate Limiting and Domain Allowlist

Read and follow AGENTS.md strictly.

Context
- The app exposes public API routes used by the browser.
- Tenant domains are known via config/tenants.json.
- We want to reduce abuse, bot spam, and traffic amplification.
- Do not store or log raw IP addresses. If IP is used for rate limiting, hash it in-memory with a salt and never persist it.

Goal
- Add request guards for public API routes:
  - Rate limiting
  - Host and Origin allowlist (known tenant domains only)
  - Method allowlist per route
  - Request size limits for JSON bodies
- Keep Stripe webhooks secure:
  - Signature verification remains the primary gate
  - Add method and content-type guards, but do not apply tenant allowlist to webhook routes

Workflow rules
- Create a new branch from main named: pr-security-01-rate-limit-allowlist
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.
- Run the project test gate locally before committing.

Task A: Central request guard utilities
A1) Add a shared module, for example:
- apps/web/src/lib/security/request_guards.ts

It must provide:
- resolveRequestHost(req): string
- assertAllowedHost(req): throws or returns error response when host is not a known tenant domain
- assertAllowedOrigin(req): when Origin is present, it must match an allowed tenant origin
- assertAllowedMethod(req, allowedMethods): enforce method allowlist
- assertMaxBodyBytes(req, maxBytes): enforce body size using Content-Length when present, otherwise enforce after parsing
- rateLimit(req, options): return 429 when the threshold is exceeded

Rate limiting requirements:
- Keying:
  - Primary key should be distinct_id cookie when present
  - Fallback key can use hashed x-forwarded-for when distinct_id is missing
- Hashing:
  - Use SHA-256(ip + RATE_LIMIT_SALT) in memory only
  - Never store raw IP in logs or tables
- Config:
  - Provide sensible defaults per route
  - Allow env overrides:
    - RATE_LIMIT_ENABLED (default true)
    - RATE_LIMIT_SALT (required in production)
    - RATE_LIMIT_WINDOW_SECONDS
    - RATE_LIMIT_MAX_REQUESTS

Task B: Apply guards to public API routes
B1) Identify and guard all browser-facing routes under apps/web/src/app/api that can be abused:
- page view and share routes
- upsell routes
- test start and test complete routes
- checkout start route
- generic analytics routes if present

At minimum, enforce:
- Allowed methods (GET or POST as appropriate)
- Allowed host and origin (tenant allowlist)
- Rate limits
- Max body size (for example 32 KB for event routes)

B2) Stripe webhook route hardening
- Enforce POST only
- Enforce Content-Type is JSON-like
- Keep signature verification as the main authorization
- Do not apply tenant allowlist to Stripe webhooks

Task C: Documentation
- Add docs/security/request_guards.md with:
  - what is enforced
  - recommended default limits per route
  - how to configure RATE_LIMIT_* env vars
  - guidance on running behind a reverse proxy

Task D: Tests
- Add unit tests for:
  - host allowlist behavior (allowed and blocked)
  - origin allowlist behavior (allowed and blocked)
  - rate limiter (429 after threshold)
- Add an integration test for 1 representative API route that verifies:
  - blocked host returns 403 or 404
  - repeated calls return 429

Success criteria
- Non-tenant domains cannot call protected API routes.
- Requests from wrong Origin are blocked when Origin is present.
- Basic bot spam results in 429 without impacting core functionality.
- Stripe webhooks remain functional and protected by signature verification.
- Tests pass locally.

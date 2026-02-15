PR-FIX-ADMIN-REDIRECT-01: Fix Admin Redirect Base (avoid 0.0.0.0 after login)

Branch name: pr/fix-admin-redirect-01

Problem
In production behind a reverse proxy, after submitting the admin token on /admin/login the browser is redirected to https://0.0.0.0:3000/admin. The login succeeds (session cookie is set) but the redirect target is built from request.url, which can be anchored to an internal host (0.0.0.0) instead of the public domain (for example https://qf.nexavi.co). This must be fixed for all admin route handlers that perform redirects.

Goal
All redirects from /api/admin/* must point to the public host that the user used in the browser.
- Prefer Origin header when present.
- Fall back to X-Forwarded-Proto and X-Forwarded-Host.
- Final fallback is request.url.

Constraints
- Do not commit secrets.
- Keep changes minimal and scoped to redirect URL construction only.
- Do not change auth logic, CSRF validation, or RBAC semantics.
- Avoid open redirect vulnerabilities: only build redirects to a same-site origin derived from request headers (Origin, forwarded, host). Do not accept arbitrary query params for target.
- Preserve existing status codes (303).

Implementation tasks

1) Add a shared helper for redirect base resolution
Create file:
- apps/web/src/lib/security/redirect_base.ts

Export:
- type PublicBaseParts = { origin: string; protocol: string; host: string };
- function resolvePublicBase(request: Request): PublicBaseParts
- function buildRedirectUrl(request: Request, pathname: string): URL

Algorithm for resolvePublicBase(request)
A) If Origin header is present and is a valid http/https URL:
- Use its origin (protocol + host + optional port).
- Return { origin, protocol, host }.

B) Else:
- Read x-forwarded-proto (take first, trim). Accept only "http" or "https".
- Read x-forwarded-host (take first, trim). If empty, read host header (take first, trim).
- If host is still empty, use new URL(request.url).host as fallback.
- If proto is missing/invalid, derive from new URL(request.url).protocol (http/https only), otherwise default to "https".
- Return origin = `${proto}://${host}`.

Notes:
- Keep parsing tolerant: header may be missing.
- Never return 0.0.0.0 or :: as host when a better signal exists:
  - If host resolves to "0.0.0.0" or "::" and x-forwarded-host exists, prefer x-forwarded-host.
- Do not throw from this helper; always return something sensible.

buildRedirectUrl(request, pathname)
- const base = resolvePublicBase(request).origin
- return new URL(pathname.startsWith("/") ? pathname : `/${pathname}`, base)

2) Apply helper to all admin route handlers that redirect
Update these files to use buildRedirectUrl(request, ...) instead of new URL(..., request.url):

- apps/web/src/app/api/admin/login/route.ts
  - buildLoginRedirect should use buildRedirectUrl(request, "/admin/login")
  - success redirect should use buildRedirectUrl(request, "/admin")
  - Keep existing error query param behavior.

- apps/web/src/app/api/admin/logout/route.ts
  - invalidCsrfRedirect and main redirect should use buildRedirectUrl(request, "/admin/login")

- apps/web/src/app/api/admin/imports/route.ts
  - buildErrorResponse redirectUrl should use buildRedirectUrl(request, "/admin/imports/new")
  - success redirect for created import should use buildRedirectUrl(request, `/admin/imports/${created.id}`)

- apps/web/src/app/api/admin/imports/[id]/route.ts
  - buildRedirectResponse should use buildRedirectUrl(request, `/admin/imports/${importId}`)

- apps/web/src/app/api/admin/publish/route.ts
  - errorRedirect and successRedirect should use buildRedirectUrl(request, "/admin")

- apps/web/src/app/api/admin/rollback/route.ts
  - errorRedirect and successRedirect should use buildRedirectUrl(request, "/admin")

Keep everything else unchanged.

3) Tests
Add unit tests for resolvePublicBase and buildRedirectUrl:
- New test file: apps/web/src/lib/security/redirect_base.test.ts

Cover:
- Uses Origin when present (https://qf.nexavi.co) even if request.url is http://0.0.0.0:3000/...
- Falls back to x-forwarded-host/proto when Origin missing
- Falls back to host header when forwarded missing
- Handles comma-separated headers (take first)
- Handles request.url with internal host but forwarded host present (prefer forwarded)

Optionally add a small integration-style test for /api/admin/login redirect target by calling POST handler with a mocked Request containing Origin, and assert Location starts with the Origin.

4) Manual verification checklist (include in PR description)
- In production behind proxy:
  - Open https://qf.nexavi.co/admin/login, submit token, verify redirect stays on https://qf.nexavi.co/admin (no 0.0.0.0).
- In local dev:
  - Run server on localhost and verify login redirects to http://localhost:3000/admin.
- Run:
  - pnpm --filter @quiz-factory/web lint
  - pnpm --filter @quiz-factory/web typecheck
  - pnpm --filter @quiz-factory/web test
  - pnpm --filter @quiz-factory/web build
  - ./scripts/smoke.sh http://localhost:3000

Commit message
PR-FIX-ADMIN-REDIRECT-01: Fix Admin Redirect Base

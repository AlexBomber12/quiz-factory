PR-ANALYTICS-09: Tenant Registry and Locale Resolution

Read and follow AGENTS.md strictly.

Context
- tenant_id is currently derived by slugifying the Host header.
- locale is currently taken from request body when provided.
- Requirement: locale must be resolved server-side from tenant config (best) or Accept-Language fallback.

Goal
- Add a tenant registry that maps domains to stable tenant_id and default locale.
- Resolve locale server-side for all analytics events and Stripe metadata.
- Ensure locale is always non-null in analytics events and in raw_stripe.purchases.

Workflow rules
- Create a new branch from main named: pr-analytics-09-tenants-locale
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.

Task A: Tenant registry
A1) Add config/tenants.json
- Structure:
  - tenants: array of objects with:
    - tenant_id (string)
    - domains (array of strings, lower-case)
    - default_locale (string, for example: en, es, pt-BR)
- Include at least 1 example tenant using the domain already used in tests (tenant.example.com).

A2) Add a tenant resolver module
- Create apps/web/src/lib/tenants/resolve.ts (or similar) that:
  - Normalizes host headers (X-Forwarded-Host first, then Host)
  - Removes port
  - Matches domain to a tenant entry
  - Returns:
    - tenant_id
    - default_locale
  - Fallback behavior:
    - tenant_id falls back to slug-based tenant id if no match
    - default_locale can be null when no match

Task B: Locale resolution
B1) Implement Accept-Language parsing
- Add a helper to parse Accept-Language and return a best-effort locale:
  - Use the first language tag and normalize (en, es, pt-BR)
  - If parsing fails, fallback to "en"
- Locale resolution priority:
  1) tenant default_locale if available
  2) Accept-Language derived locale
  3) "en"

B2) Apply locale resolution everywhere server-side
- Update apps/web/src/lib/analytics/server.ts:
  - Stop reading locale from request body as the canonical source.
  - Use resolved locale from tenant config or Accept-Language.
  - Ensure buildBaseEventProperties receives locale as a non-null value.
- Update Stripe checkout creation:
  - Ensure metadata.locale is set from the same resolved locale.

Task C: Tests
- Add unit tests for:
  - domain match to tenant_id
  - Accept-Language parsing edge cases
  - locale resolution priority order

Success criteria
- tenant_id is stable for configured domains and no longer depends only on slugification.
- locale is always non-null in all captured analytics events.
- Stripe metadata includes the resolved locale.
- Tests pass locally.

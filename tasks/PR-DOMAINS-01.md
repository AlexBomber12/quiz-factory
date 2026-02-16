PR-DOMAINS-01: DB-backed Domain Registry (Tenants Source of Truth)

Read and follow AGENTS.md strictly.

Context
- The admin console is evolving into a control panel for domains (tenants). A domain is the unit of business.
- Today, tenants are file-based (config/tenants.json generated from config/tenants.csv). This limits operational control and automation.
- We need tenants as first-class data in the Content DB, editable in the admin UI, with safe rollout and backward compatibility.

Goal
- Make the tenant registry DB-backed and editable via Admin UI:
  - tenant_id (stable identifier used across analytics and publications)
  - domains/hostnames (multiple per tenant)
  - default_locale (still constrained to en/es/pt-BR for now)
  - enabled flag
- Keep file-based tenants as a supported fallback during rollout.
- Ensure public runtime tenant resolution and host allowlisting can read from the DB when enabled.

Non-goals
- Do not change how tests are created/imported/published in this PR.
- Do not introduce new locales beyond en/es/pt-BR.
- Do not remove config/tenants.csv or the generation scripts.

Implementation requirements
- DB schema (Content DB)
  - Add a migration that creates:
    - tenants table:
      - tenant_id text PRIMARY KEY
      - default_locale text NOT NULL
      - enabled boolean NOT NULL DEFAULT true
      - created_at timestamptz NOT NULL DEFAULT now()
      - updated_at timestamptz NOT NULL DEFAULT now()
    - tenant_domains table:
      - tenant_id text NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE
      - domain text NOT NULL
      - PRIMARY KEY (tenant_id, domain)
      - UNIQUE(domain)
    - updated_at trigger or app-level update to keep updated_at current
- One-time import script (idempotent)
  - Add apps/web/scripts/tenants-db-import-file.js:
    - reads config/tenants.json
    - upserts tenants and tenant_domains
    - safe to run multiple times
- Runtime selection (feature flag)
  - Add env var TENANTS_SOURCE with values: file or db (default: file)
  - Update tenant resolution (apps/web/src/lib/tenants/resolve.ts + request.ts):
    - if TENANTS_SOURCE=db, resolve tenant by host using tenant_domains in DB with caching (TTL 60s)
    - else keep current file-based behavior
  - Update host allowlist (apps/web/src/lib/security/request_guards.ts):
    - keep current behavior for TENANTS_SOURCE=file
    - for TENANTS_SOURCE=db, allowed hosts are loaded from DB with caching (TTL 60s)
    - because DB access is async, introduce async variants:
      - assertAllowedHostAsync(request)
      - assertAllowedOriginAsync(request)
      - and update all public event API routes to await these
    - keep existing sync helpers for file mode to avoid large diff where possible
- Admin UI
  - Extend existing pages (keep routes stable):
    - /admin/tenants: list tenants from DB when TENANTS_SOURCE=db, otherwise show file tenants as read-only
    - /admin/tenants/[tenant_id]: tenant detail with editable fields (default_locale, enabled) and domains list (add/remove)
    - add “Create tenant” flow (modal or /admin/tenants/new) that creates tenant_id + at least 1 domain
  - Admin API routes (protected by existing admin middleware + CSRF):
    - GET/POST /api/admin/tenants
    - GET/PATCH/DELETE /api/admin/tenants/[tenant_id]
    - POST/DELETE /api/admin/tenants/[tenant_id]/domains
  - Audit logging:
    - logAdminEvent for create/update/delete tenant and add/remove domain
- Documentation
  - Update docs/tenants.md:
    - explain TENANTS_SOURCE
    - explain import script
    - include a safe rollout procedure (file to db)

Workflow rules
- Create a new branch from main named: pr-domains-01-tenant-registry-db
- Implement only what this task requests.

Definition of Done
- With TENANTS_SOURCE=db:
  - /admin/tenants lists tenants from DB and can create/update/delete
  - adding/removing a domain updates DB and is reflected in tenant resolution within 60s
  - public event endpoints accept requests for newly added domains (host allowlist reads DB)
- With TENANTS_SOURCE=file:
  - behavior is unchanged
- scripts/ci.sh --scope app passes.

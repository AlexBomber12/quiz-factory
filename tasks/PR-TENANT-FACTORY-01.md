PR-TENANT-FACTORY-01: Tenant Profiles and Niche Presets (Hybrid Hub + Niche)

Read and follow AGENTS.md strictly.

Context
- config/tenants.json is strictly validated and only contains routing essentials.
- We want a hybrid setup: a hub tenant (catalog-first) plus niche tenants (focused landing with 1-3 tests).
- We need a way to configure tenant kind and homepage behavior without changing the tenants.json schema.

Goal
- Add a new tenant profiles config file that describes hub vs niche behavior.
- Implement a loader and safe defaults when no profile exists.
- Update the tenant homepage to support niche tenants (featured tests only).
- Add validation scripts so profiles are deterministic and CI-safe.

Non-goals
- Do not change config/tenants.json schema.
- Do not add A/B experiments yet.
- Do not add per-tenant design themes beyond simple copy overrides.

Workflow rules
- Create a new branch from main named: pr-tenant-factory-01-niche-presets
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.
- Run the project test gate locally before committing.

Task A: Tenant profiles config
A1) Add config/tenant_profiles.json
- Top-level object: { "profiles": [ ... ] }
- Each profile object keys (exact):
  - tenant_id: string
  - tenant_kind: "hub" | "niche"
  - label: string
  - home_headline: string
  - home_subheadline: string
  - featured_test_slugs: string[]
- Deterministic ordering:
  - profiles sorted by tenant_id
  - featured_test_slugs sorted

A2) Add a small example profile for tenant-tenant-example-com.
- tenant_kind: hub
- featured_test_slugs can include the golden test slug.

Task B: Loader (server-side)
B1) Implement loader with safe defaults.
- Create: apps/web/src/lib/tenants/profiles.ts
- Exports:
  - type TenantProfile
  - getTenantProfile(tenantId): TenantProfile | null
  - resolveTenantKind(tenantId): "hub" | "niche"
  - resolveHomepageCopy(tenantId): { headline: string; subheadline: string }
- Requirements:
  - If config is missing or invalid, return null and default kind to "hub".
  - Cache in-memory for 60 seconds (similar pattern to other config reads).

Task C: Homepage behavior for niche tenants
C1) Update tenant homepage to use profiles.
- File: apps/web/src/app/page.tsx
- Behavior:
  - Resolve tenantId + locale as before.
  - Load full catalog.
  - If tenant_kind is "niche" and featured_test_slugs is non-empty:
    - Filter catalog to only those slugs (preserve order from featured_test_slugs).
    - Show a focused hero using home_headline and home_subheadline.
    - If filtering results in 0 tests, fall back to full catalog.
  - If tenant_kind is "hub": keep existing behavior, but use home headline copy if present.

C2) Reuse the PublicNav if it exists.
- If PR-HUB-01 introduces PublicNav, use it on the homepage.
- Otherwise keep the existing layout unchanged.

Task D: Validation scripts
D1) Add a validator similar to validate_tenants.py
- Create: scripts/tenants/validate_tenant_profiles.py
- Validate:
  - keys are exact
  - tenant_id matches an entry in config/tenants.json
  - tenant_kind is hub or niche
  - featured_test_slugs entries are normalized slugs
  - deterministic formatting (sorted)

D2) Wire validation into scripts/ci.sh
- After validate_tenants.py, run validate_tenant_profiles.py.

Task E: Tests
E1) Unit test the profile loader.
- Create: apps/web/src/lib/tenants/profiles.test.ts
- Use a temporary fixture file approach:
  - allow the loader to accept an optional file path for tests, or
  - allow injection of raw JSON text.
- Verify:
  - unknown tenant returns null and defaults to hub
  - niche tenant filters featured tests
  - cache does not change output for the same input

Success criteria
- scripts/ci.sh exits 0.
- Tenants can be labeled as hub or niche without modifying tenants.json.
- Niche tenants show only featured tests on the homepage.

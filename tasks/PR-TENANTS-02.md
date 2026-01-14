PR-TENANTS-02: Tenant Provisioning CLI and CI Validation

Read and follow AGENTS.md strictly.

Context
- config/tenants.json exists and is used for tenant_id and default_locale resolution.
- We need to scale tenants to 200 domains without manual editing and without mistakes.

Goal
- Provide a deterministic provisioning workflow to generate and validate tenants config.

Workflow rules
- Create a new branch from main named: pr-tenants-02-provisioning
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.

Task A: Tenant import script (CSV to tenants.json)
A1) Add a script under scripts/tenants/
- Name: scripts/tenants/import_csv.(ts|py)
- Input CSV columns:
  - tenant_id
  - domains (comma-separated or multiple rows)
  - default_locale
- Output:
  - config/tenants.json regenerated deterministically
- Rules:
  - domains must be lowercase, normalized, and unique across all tenants
  - tenant_id must be unique
  - default_locale must be one of: en, es, pt-BR (extendable list in code)
  - the script must fail with a non-zero exit code on validation errors

A2) Dry-run mode
- Support a flag like --check-only that validates without writing.

Task B: CI validation
B1) Add a CI step (or npm script) that validates tenants.json
- Ensure domains are unique.
- Ensure locales are valid.
- Ensure file is sorted deterministically (stable diffs).

Task C: Documentation
- Add docs/tenants.md:
  - how to add a tenant via CSV
  - how to validate
  - how tenant resolution works at runtime

Success criteria
- A new tenant can be added by editing a CSV and running 1 command.
- CI fails on duplicated domains or invalid locales.
- config/tenants.json remains deterministic and stable across runs.
- docs/tenants.md exists and is accurate.

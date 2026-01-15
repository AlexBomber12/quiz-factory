# Tenants

## Overview
- `config/tenants.json` is generated from `config/tenants.csv`.
- `tenant_id` follows `tenant-<slug>` as defined in `docs/metrics.md`.
- Supported locales: `en`, `es`, `pt-BR`.

## Add or update a tenant
1) Edit `config/tenants.csv`.
2) Run `python3 scripts/tenants/import_csv.py`.

CSV columns:
- `tenant_id`
- `domains` (comma-separated or split across multiple rows)
- `default_locale`

Notes:
- Domains are normalized to lowercase and must be unique across tenants.
- Use `--check-only` to validate the CSV without writing `config/tenants.json`.

## Validate tenants.json
- Run `python3 scripts/tenants/validate_tenants.py`.
- CI runs the same validation via `scripts/ci.sh`.

## Runtime resolution
- `apps/web/src/lib/tenants/resolve.ts` loads `config/tenants.json`.
- The host is read from `x-forwarded-host`, then `host`, then the fallback host.
- If the host matches a configured domain, the tenant_id and default_locale are returned.
- If no match exists, the tenant_id falls back to `tenant-<slug>` from the host and locale falls back to `Accept-Language`.

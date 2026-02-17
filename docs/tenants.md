# Tenants

## Overview
- `tenant_id` follows `tenant-<slug>` as defined in `docs/metrics.md`.
- Supported locales remain: `en`, `es`, `pt-BR`.
- Tenant source is controlled by `TENANTS_SOURCE`:
  - `file` (default): load from `config/tenants.json`.
  - `db`: load from Content DB tables `tenants` and `tenant_domains`.

## File-based source (`TENANTS_SOURCE=file`)
- `config/tenants.json` is generated from `config/tenants.csv`.
- Add or update tenants:
1. Edit `config/tenants.csv`.
2. Run `python3 scripts/tenants/import_csv.py`.
- CSV columns:
  - `tenant_id`
  - `domains` (comma-separated or split across multiple rows)
  - `default_locale`
- Validate generated config:
  - `python3 scripts/tenants/validate_tenants.py`

## DB-backed source (`TENANTS_SOURCE=db`)
- Required tables are created by Content DB migration `0006_tenants_registry.sql`.
- Import current file tenants into DB with:
```bash
CONTENT_DATABASE_URL=postgres://... \
node apps/web/scripts/tenants-db-import-file.js
```
- The import is idempotent and can be re-run safely.

## Runtime resolution
- Tenant resolution and host allowlisting read from:
  - `config/tenants.json` when `TENANTS_SOURCE=file`
  - `tenants` + `tenant_domains` when `TENANTS_SOURCE=db`
- DB lookups are cached for 60 seconds.
- Unknown hosts still fall back to `tenant-<slug>` for tenant resolution.

## Safe rollout: file -> db
1. Ensure `CONTENT_DATABASE_URL` points to the target Content DB.
2. Run migrations: `node apps/web/scripts/content-db-migrate.js`.
3. Import file tenants:
   - `node apps/web/scripts/tenants-db-import-file.js`
4. Verify DB data:
   - `SELECT tenant_id, default_locale, enabled FROM tenants ORDER BY tenant_id;`
   - `SELECT tenant_id, domain FROM tenant_domains ORDER BY tenant_id, domain;`
5. In staging, set `TENANTS_SOURCE=db` and verify:
   - `/admin/tenants` CRUD works
   - public event endpoints accept known tenant domains
6. Promote the same setting to production.

## Rollback
- Set `TENANTS_SOURCE=file` and redeploy.
- File-based resolution resumes immediately.

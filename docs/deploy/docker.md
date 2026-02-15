# Docker Deploy (Single Host)

## Prerequisites
- Docker Engine 24+ running on a Linux host.
- Docker Compose plugin (`docker compose` command).
- Node.js 24 + pnpm (for migrations and verification scripts run from the repo checkout).

## Bootstrap and configure
1. Run bootstrap:
   ```bash
   ./scripts/bootstrap.sh
   ```
2. Edit `config/tenants.local.json` and set:
   - `tenant_id` (for example `tenant-qf-local`)
   - `domains` (for example `qf.local`)
3. Point your browser host to the Linux machine:
   - DNS: create an `A`/`AAAA` record for `qf.local`, or
   - Hosts file: add `<LINUX_HOST_IP> qf.local`
4. Review `.env.production` and replace placeholders as needed.

## Content DB migrations (before or after first start)
1. If you need host access to Postgres, expose `content-db` on `5433` with an override:
   ```yaml
   services:
     content-db:
       ports:
         - "5433:5432"
   ```
2. Start DB:
   ```bash
   docker compose up -d content-db
   ```
3. Run migrations from the repo root:
   ```bash
   CONTENT_DATABASE_URL=postgres://content:content@localhost:5433/content_db \
     pnpm --filter @quiz-factory/web db:migrate
   ```
4. Re-run the same command. Expect: `Content DB migrations are up to date.`
5. Optional schema/provider verification:
   ```bash
   CONTENT_DATABASE_URL=postgres://content:content@localhost:5433/content_db \
     ./scripts/ops/verify_admin_analytics.sh
   ```

## Start services (standalone output)
```bash
docker compose up -d --build
```

The web image runs Next.js standalone output (`output: "standalone"`) via:
`node apps/web/server.js`.

## Manual standalone entrypoint (no Docker)
```bash
pnpm --filter @quiz-factory/web build
HOSTNAME=0.0.0.0 PORT=3000 node apps/web/.next/standalone/apps/web/server.js
```

## Admin analytics mode configuration
- `ADMIN_ANALYTICS_MODE` override values: `bigquery`, `content_db`, `mock`.
- If override is unset, provider selection is automatic:
  - `bigquery` when required BigQuery env vars are present.
  - otherwise `content_db` when `CONTENT_DATABASE_URL` is present.
  - otherwise `mock`.
- BigQuery envs required by selector:
  - `BIGQUERY_PROJECT_ID`
  - `BIGQUERY_STRIPE_DATASET`
  - `BIGQUERY_RAW_COSTS_DATASET`
  - `BIGQUERY_TMP_DATASET`
- Content DB env required:
  - `CONTENT_DATABASE_URL`
- Verify current selection and DB table readiness:
  ```bash
  ./scripts/ops/verify_admin_analytics.sh
  ```

## Health checks and operator checklist
- API health:
  ```bash
  curl -sSf -H "Host: qf.local" http://localhost:3000/api/health
  ```
- Open `http://qf.local:3000/admin/login` and confirm login page loads.
- Open `http://qf.local:3000/admin/analytics` and confirm it is using non-mock data when configured.
- Confirm Stripe webhook events are arriving for `https://<domain>/api/stripe/webhook`.

## Troubleshooting
- Tenant domain allowlist out of date:
  ```bash
  python3 scripts/tenants/import_csv.py
  python3 scripts/tenants/validate_tenants.py
  ```
  Then redeploy so `config/tenants.json` is refreshed in runtime.
- Proxy/header mismatch:
  - Keep `TRUST_X_FORWARDED_HOST=false` unless a trusted proxy overwrites `x-forwarded-host`.
  - When enabled, ensure proxy forwards canonical tenant hostnames.
- Ports already in use:
  - Change `web` host port mapping in `docker-compose.yml` (for example `3001:3000`).
- View logs:
  ```bash
  docker compose logs -f web
  docker compose logs -f content-db
  ```
- Reset database:
  ```bash
  docker compose down -v
  docker compose up -d --build
  ```

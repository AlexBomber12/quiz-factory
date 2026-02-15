# Deploy with GHCR Image (Single Host)

## Prerequisites
- Docker Engine 24+ running on a Linux host.
- Docker Compose plugin (`docker compose` command).
- Node.js 24 + pnpm (for migrations and verification scripts run from the repo checkout).

## Bootstrap local config files
Run bootstrap to create local runtime files:

```bash
./scripts/bootstrap.sh
```

This creates local copies such as `.env.production` and `config/tenants.local.json` when missing.
Review and update them before deploying.

## Content DB migrations and schema verification
1. Bring up Postgres:
   ```bash
   docker compose -f docker-compose.ghcr.example.yml up -d content-db
   ```
2. Expose DB to host (optional but recommended for migration tooling):
   - add `5433:5432` for `content-db` in an override compose file.
3. Run migrations from the repo root:
   ```bash
   CONTENT_DATABASE_URL=postgres://content:content@localhost:5433/content_db \
     pnpm --filter @quiz-factory/web db:migrate
   ```
4. Re-run the same command and confirm `Content DB migrations are up to date.`
5. Run analytics/provider verification:
   ```bash
   CONTENT_DATABASE_URL=postgres://content:content@localhost:5433/content_db \
     ./scripts/ops/verify_admin_analytics.sh
   ```

## Deploy using prebuilt GHCR image (standalone runtime)
Use the GHCR compose template (no local image build):

```bash
docker compose -f docker-compose.ghcr.example.yml pull
docker compose -f docker-compose.ghcr.example.yml up -d
```

The GHCR image runs the Next.js standalone server entrypoint:
`node apps/web/server.js`.

## Manual standalone entrypoint (no Docker)
```bash
pnpm --filter @quiz-factory/web build
HOSTNAME=0.0.0.0 PORT=3000 node apps/web/.next/standalone/apps/web/server.js
```

## Admin analytics mode configuration
- `ADMIN_ANALYTICS_MODE` override values: `bigquery`, `content_db`, `mock`.
- Required envs for `bigquery` selection:
  - `BIGQUERY_PROJECT_ID`
  - `BIGQUERY_STRIPE_DATASET`
  - `BIGQUERY_RAW_COSTS_DATASET`
  - `BIGQUERY_TMP_DATASET`
- Required env for `content_db` selection:
  - `CONTENT_DATABASE_URL`
- With no override, selector falls back `bigquery -> content_db -> mock`.
- Verify what would be selected:
  ```bash
  ./scripts/ops/verify_admin_analytics.sh
  ```

## Operator checklist
- Confirm `/api/health` returns 200.
- Confirm `/admin/login` loads.
- Confirm `/admin/analytics` shows non-mock mode when your env is configured.
- Confirm Stripe webhook events are received at `/api/stripe/webhook`.

## Troubleshooting
- Tenant domains/allowlist drift:
  ```bash
  python3 scripts/tenants/import_csv.py
  python3 scripts/tenants/validate_tenants.py
  ```
  Redeploy after regenerating `config/tenants.json`.
- Proxy/header handling:
  - Set `TRUST_X_FORWARDED_HOST=true` only when a trusted proxy overwrites host headers.
  - Keep it `false` for direct traffic to avoid host spoofing.

## GHCR package visibility
- Public package: `docker pull` works anonymously.
- Private package: authenticate first with a PAT that has `read:packages`:

```bash
echo "<GH_PAT_WITH_READ_PACKAGES>" | docker login ghcr.io -u "<github-username>" --password-stdin
```

## Pin and rollback with sha tags
By default, the compose file uses `latest`. To pin a specific build:

```bash
export QF_WEB_IMAGE_TAG=sha-<shortsha>
docker compose -f docker-compose.ghcr.example.yml pull
docker compose -f docker-compose.ghcr.example.yml up -d
```

To rollback, set `QF_WEB_IMAGE_TAG` to an older `sha-` tag and run the same pull/up commands again.

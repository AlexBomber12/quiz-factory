# Deploy Runbook

## Platform assumptions
- The web app is a Next.js 16 server in `apps/web` that runs on Node.js 24 (`.node-version`) using pnpm via Corepack.
- Deployments run `next build` and `next start` (no repo-managed web container or platform config exists today).
- Traffic is terminated by a reverse proxy or platform edge that forwards requests to the Node process.
- Host allowlisting relies on the request host; if your proxy rewrites the Host header, set `TRUST_X_FORWARDED_HOST=true`.
- Tenant domains are resolved from `config/tenants.json`, which is generated from `config/tenants.csv` (see `docs/tenants.md`).

## Environment variables

### Non-secret configuration (names only)
- NODE_ENV
- COMMIT_SHA
- STRIPE_PRICE_SINGLE_INTRO_149_EUR
- STRIPE_PRICE_PACK5_EUR
- STRIPE_PRICE_PACK10_EUR
- STRIPE_PRICE_SINGLE_BASE_299_EUR
- POSTHOG_HOST
- BIGQUERY_PROJECT_ID
- GOOGLE_CLOUD_PROJECT
- GCP_PROJECT
- BIGQUERY_STRIPE_DATASET
- BIGQUERY_RAW_COSTS_DATASET
- BIGQUERY_TMP_DATASET
- RATE_LIMIT_ENABLED
- RATE_LIMIT_WINDOW_SECONDS
- RATE_LIMIT_MAX_REQUESTS
- ATTEMPT_TOKEN_TTL_SECONDS
- PAGE_VIEW_SAMPLE_RATE
- TRUST_X_FORWARDED_HOST
- EXTRA_ALLOWED_HOSTS
- STUDIO_ENABLED

### Secrets (names only)
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- POSTHOG_SERVER_KEY
- ATTEMPT_TOKEN_SECRET
- RESULT_COOKIE_SECRET
- REPORT_TOKEN_SECRET
- RATE_LIMIT_SALT
- GOOGLE_APPLICATION_CREDENTIALS

## Staging deploy
1. Ensure the branch is up to date and run `scripts/ci.sh`.
2. Configure staging environment variables, using Stripe test mode keys and a staging domain present in `config/tenants.csv`.
3. Build and run the web app:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm --filter @quiz-factory/web build
pnpm --filter @quiz-factory/web start -- --hostname 0.0.0.0 --port 3000
```

4. Route the staging domain to the running service and ensure the proxy forwards the correct host.
5. Run the smoke checks against staging: `scripts/smoke.sh https://staging.example.com`.

## Production deploy
1. Confirm staging is healthy and smoke checks pass.
2. Merge to `main` and deploy the intended commit with production environment variables.
3. Use the same build and start commands as staging.
4. Run the smoke checks against production: `scripts/smoke.sh https://<tenant-domain>`.

## Bind a new tenant domain
1. Edit `config/tenants.csv` to add or update the tenant and domain.
2. Run `python3 scripts/tenants/import_csv.py`.
3. Run `python3 scripts/tenants/validate_tenants.py` or the full gate via `scripts/ci.sh`.
4. Deploy the updated commit.
5. Point DNS for the domain to the deployment platform.
6. Verify `https://<domain>/api/health` and run `scripts/smoke.sh https://<domain>`.

## Stripe webhooks
- Webhook endpoint URL: `https://<domain>/api/stripe/webhook`
- Stripe events to subscribe:
- `checkout.session.completed`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `charge.refunded`
- `charge.dispute.created`
- Set `STRIPE_WEBHOOK_SECRET` to the signing secret for the endpoint.
- Ensure `STRIPE_SECRET_KEY` is set; the webhook handler uses it to resolve fees and metadata.
- Validate by running a test checkout and then running `scripts/smoke.sh https://<domain>`.

## PostHog connection settings
- Set `POSTHOG_SERVER_KEY` to the project API key.
- Set `POSTHOG_HOST` if you are self-hosting PostHog; otherwise the default `https://app.posthog.com` is used.
- See `docs/ops/posthog_runbook.md` for operational guidance.

## Rollback strategy
1. Redeploy the last known good commit.
2. Restore the previous environment variable set if it changed.
3. Run `scripts/smoke.sh https://<domain>` and check `/api/health`.
4. If the issue is domain allowlisting, revert `config/tenants.csv`, re-run `scripts/tenants/import_csv.py`, and redeploy.

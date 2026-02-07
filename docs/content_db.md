# Content Database (Postgres)

This project now includes a Postgres-backed content DB scaffold for tests,
versions, tenant publishing state, and import tracking.

## Required env vars

- `CONTENT_DATABASE_URL`
  - Example local value:
    `postgres://content:content@localhost:5433/content_db`
  - This is non-secret in local dev, but should still come from environment
    configuration in CI/deploy.

## Local setup

1. Start Postgres:
   ```bash
   docker compose -f infra/content-db/docker-compose.yml up -d
   ```
2. Export DB URL:
   ```bash
   export CONTENT_DATABASE_URL=postgres://content:content@localhost:5433/content_db
   ```
3. Run migrations:
   ```bash
   pnpm --filter @quiz-factory/web run db:migrate
   ```
4. Optional: verify schema quickly:
   ```bash
   docker compose -f infra/content-db/docker-compose.yml exec postgres psql -U content -d content_db -c '\dt'
   ```

Stop local Postgres:

```bash
docker compose -f infra/content-db/docker-compose.yml down
```

## Migration runner

- Runner command:
  `pnpm --filter @quiz-factory/web run db:migrate`
- Migration files directory:
  `apps/web/src/lib/content_db/migrations`
- Ordering:
  lexical file order (`0001_*.sql`, `0002_*.sql`, ...)
- Tracking table:
  `applied_migrations` with file name + checksum.
- Safety:
  if a previously applied migration file is edited, the checksum mismatch fails
  fast to prevent silent drift.

## CI usage

In CI, run the same migration command after setting `CONTENT_DATABASE_URL` to
the CI Postgres service URL.

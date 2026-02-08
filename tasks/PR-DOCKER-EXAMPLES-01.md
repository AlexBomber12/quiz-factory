PR-DOCKER-EXAMPLES-01: Docker Example Templates + Bootstrap Script

Read and follow AGENTS.md strictly.

Context
- We are moving the runtime to a Linux machine on the network (not WSL).
- We want to reduce manual setup work by shipping example config files that can be copied or renamed.
- Example files MUST NOT contain real secrets.
- The repo uses pnpm.

Non-goals
- Do not add PostHog, BigQuery, reverse proxies, TLS, or Cloud provider deployment in this PR.
- Do not change pricing, product logic, or analytics behavior.

Deliverables

1) Docker build artifacts
- Add apps/web/Dockerfile that builds and runs the web app in production mode.
  - Use a multi-stage build.
  - Use pnpm and workspace-aware install and build.
  - Keep the runtime image minimal.
- Add .dockerignore if missing (exclude node_modules, .next, dist, tmp, .git, etc).

2) Example Docker Compose
- Add docker-compose.example.yml (or .yaml) in repo root.
  - Services:
    - content-db: Postgres (postgres:16-alpine), volume for data, healthcheck with pg_isready.
    - web: build from repo (uses apps/web/Dockerfile).
  - web container:
    - Expose and publish 3000 (host 3000 to container 3000).
    - depends_on content-db healthy.
    - Use env_file: .env.production
    - Provide database URL env var that the app actually uses (inspect the code and match the expected name).
  - content-db should not publish its port by default. If a port is needed for local debugging, document how to enable it via override.

3) Example environment templates
- Add .env.production.example in repo root.
  - Include every env var required for the app to boot in production (inspect code).
  - Put CHANGE_ME placeholders for secrets.
  - Include a clearly marked section Required vs Optional.
- Optional: add .env.local.example for pnpm dev (only if your repo already expects it).

4) Example tenant config
- Add config/tenants.example.json (single tenant, domain qf.local, default locale en).
- Do not overwrite tracked config/tenants.json in the bootstrap script.

5) Safety rails
- Update .gitignore so local runtime files never get committed:
  - .env.production
  - .env.local
  - docker-compose.yml
  - docker-compose.override.yml
  - config/tenants.local.json
  - any local SSL certs if present (certs/, *.pem, *.key)

6) Bootstrap script
- Add scripts/bootstrap.sh (bash).
  - If the working files do not exist, create them by copying from examples:
    - docker-compose.example.yml -> docker-compose.yml
    - .env.production.example -> .env.production
    - config/tenants.example.json -> config/tenants.local.json
  - If .env.production exists, do not overwrite it.
  - Generate secrets for a fixed allowlist of keys if their value is exactly CHANGE_ME:
    - ATTEMPT_TOKEN_SECRET
    - REPORT_TOKEN_SECRET
    - RESULT_COOKIE_SECRET
    - ADMIN_SESSION_SECRET
    - RATE_LIMIT_SALT
    - plus any other *_SECRET keys that exist in .env.production.example (keep it deterministic and safe)
  - Generation method:
    - Prefer openssl rand -base64 32.
    - If openssl is missing, exit with a clear message.
  - Print next steps:
    - how to edit config/tenants.local.json (domain and tenant_id)
    - how to point your browser to the Linux host (hosts file or DNS)
    - how to run docker compose up -d --build
    - how to check health

7) Minimal runbook
- Add docs/deploy/docker.md:
  - prerequisites (docker engine + docker compose plugin)
  - steps (bootstrap, configure domain, compose up)
  - troubleshooting (ports, logs, db reset)

Workflow rules
- Create a new branch from main named: pr-docker-examples-01
- Implement only what this task requests.
- Run the standard test gate before committing.
- Commit message: "PR-DOCKER-EXAMPLES-01: docker examples + bootstrap"

Definition of Done
- On a fresh clone:
  - ./scripts/bootstrap.sh creates docker-compose.yml, .env.production, and config/tenants.local.json
  - docker compose up -d --build succeeds
  - curl -sSf http://localhost:3000/api/health returns HTTP 200 (if the app uses a different health endpoint, document and use that)
  - The homepage renders when accessed with a Host header that matches the example tenant domain (document in the runbook)
- No real secrets are added to the repo (only placeholders in *.example files).
- Git status stays clean after running bootstrap (generated files are ignored).

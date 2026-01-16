PR-OPS-POSTHOG-03: PostHog Hardening and Backups

Read and follow AGENTS.md strictly.

Context
- PostHog is self-hosted and is production infrastructure.
- We need operational hardening and reliable backups.

Goal
- Add production-ready operational practices:
  - pinned versions and health checks
  - secure admin access guidance
  - backup and restore scripts and runbook

Workflow rules
- Create a new branch from main named: pr-ops-posthog-03-hardening
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.
- Run the project test gate locally before committing.

Task A: Runbook
- Add docs/ops/posthog_runbook.md covering:
  - recommended deployment architecture
  - how to secure admin access
  - update procedure (version pinning, rollout steps)
  - incident checklist (PostHog down, ClickHouse issues)
  - verification that $geoip_disable and discard IP settings are enabled

Task B: Backup scripts
- Add scripts/ops/posthog_backup.sh
- Add scripts/ops/posthog_restore.sh

Requirements:
- Must support Postgres and ClickHouse backups for the self-hosted setup.
- Must support a local backup directory and an optional remote target.
- Must not print secrets.
- Provide a dry-run mode.

Task C: Compose hardening (if repo contains docker-compose for PostHog)
- Pin image tags to specific versions.
- Add healthchecks.
- Ensure services restart policies are set.
- Document any required environment variables in docs, not in committed .env.

Success criteria
- docs/ops/posthog_runbook.md exists and is complete.
- backup and restore scripts exist and can run in dry-run.
- Compose hardening changes are applied if applicable.

# AGENTS

These rules apply to any PR task in this repo:

- Always use `tasks/PR-*.md` workflow.
- Branch naming convention `pr-<area>-<id>-<slug>`.
- No secrets.
- All definitions are governed by `docs/metrics.md`.
- Read the relevant `tasks/PR-xx.md` before starting.
- Implement only the requested change.
- Run `scripts/ci.sh` and ensure it exits 0.
- Generate artifacts via `scripts/make-review-artifacts.sh`.
- Provide a short report (what changed, how verified, manual test steps if applicable).

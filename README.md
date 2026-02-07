# Quiz Factory

Quiz Factory is a multi-tenant test network repository that houses the apps, analytics, and infrastructure needed to run quizzes and measure performance, and the single source of truth for metrics definitions is docs/metrics.md.

## Review Artifacts

Run `scripts/make-review-artifacts.sh` to generate review outputs.

- Primary snapshot archive: `artifacts/snapshot_<YYYYMMDD-HHMMSS>.zip` (UTC timestamp).
- Stable alias for compatibility: `artifacts/snapshot.zip` (copied from the latest timestamped archive).

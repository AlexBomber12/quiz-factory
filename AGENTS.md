# AGENTS

These rules apply to any PR task in this repo:

- Always use `tasks/PR-*.md` workflow.
- Branch naming convention `pr-<sanitized-pr-id>` (lowercase, `.` -> `-`, keep `[a-z0-9-]`).
- No secrets.
- All definitions are governed by `docs/metrics.md`.
- Read the relevant `tasks/PR-xx.md` before starting.
- Implement only the requested change.
- Run `scripts/ci.sh` and ensure it exits 0.
- Generate artifacts via `scripts/make-review-artifacts.sh`.
- Provide a short report (what changed, how verified, manual test steps if applicable).

## Standard PR Runbook (Default Workflow)

### Rules
- Preflight: `git status --porcelain` must be empty; if not, stop and list dirty files.
- Task selection: if `tasks/QUEUE.md` exists, pick the earliest `DOING` entry; otherwise pick the earliest `TODO` entry whose dependencies are `DONE`. Extract `PR_ID` exactly as written in QUEUE. Extract `TASK_FILE` from the `Tasks file:` line, do not guess filenames. If no selectable task exists, stop and report the first blocked `TODO` and missing dependencies.
- Branching: `git fetch origin main`. Create a branch from `origin/main` named `pr-<sanitized-pr-id>` where sanitized is lowercase, `.` -> `-`, keep `[a-z0-9-]`.
- Implementation: implement exactly `TASK_FILE` scope, no extra refactors or dependency upgrades unless required. `tasks/PR-*.md` files are immutable during execution unless explicitly instructed; do not create new tasks mid-run.
- CI: single source of truth. If `scripts/ci.sh` exists, run it; else follow AGENTS-defined command; else fall back to platform scripts. Fix and rerun until exit code 0; do not claim success otherwise.
- Artifacts: always generate `artifacts/ci.log` and `artifacts/pr.patch`. Prefer `scripts/make-review-artifacts.*` if present; else specify manual commands used.
- QUEUE update: update only the `- Status:` line for the selected PR entry. Set Status to `DONE` after CI is green and before push.
- Commit/Push/PR: commit message "`<PR_ID>: <short summary>`"; push branch; open PR if `gh` is available, otherwise print manual steps.
- Final report: include `PR_ID`, `TASK_FILE`, branch, CI cmd, artifacts, commit hash, PR link or next steps.

### Checklist
- [ ] Preflight: `git status --porcelain` is empty; if not, stop and list dirty files.
- [ ] Select task from `tasks/QUEUE.md` per rules; capture `PR_ID` and `TASK_FILE`.
- [ ] `git fetch origin main`; create a branch from `origin/main` named `pr-<sanitized-pr-id>`.
- [ ] Implement only `TASK_FILE` scope; avoid extra refactors or dependency upgrades.
- [ ] Run CI until exit 0; generate artifacts (`artifacts/ci.log`, `artifacts/pr.patch`).
- [ ] Update only the selected PR `- Status:` line in `tasks/QUEUE.md` to `DONE`.
- [ ] Commit with "`<PR_ID>: <short summary>`"; push; open PR or provide manual steps.
- [ ] Final report with required fields.

## Tasks Stability and Queue Updates
- tasks/ is the source of truth. During implementation of a PR task, treat `tasks/PR-*.md` files as immutable unless explicitly instructed to change them.
- The agent must not create or modify any `tasks/PR-*.md` other than the currently selected PR task file, unless explicitly instructed.
- If the user changes tasks/ while a coding session is in progress (new files or edits), the agent must stop, explain that the task inputs changed, and ask for explicit instruction to either (a) include those changes now, or (b) revert them and proceed. The agent must not silently proceed with a moving target.
- The agent is allowed to edit `tasks/QUEUE.md` only to update Status lines for the PR being worked on and to synchronize DONE states after merges.

## Queue Status Rules
- When starting work on PR-XXX, set its status to DOING in `tasks/QUEUE.md`.
- Set status to DONE after CI is green and before push.

## Two Worktrees (Optional)
- To avoid unexpected changes, keep planning edits to tasks/ in a separate worktree from the implementation worktree when running long agent sessions.

## Lessons Learned (Append-Only)
- Any recurring annoyance or failure mode must be recorded here as a rule or automation idea.
- Keep entries short: Symptom -> Rule -> Automation.

# AGENTS

These rules apply to any PR task in this repo:

- Choose a work mode using the trigger phrases in Work Modes.
- Branch naming: PLANNED uses `pr-<sanitized-pr-id>` (lowercase, `.` -> `-`, keep `[a-z0-9-]`); MICRO uses `micro-YYYYMMDD-<short-slug>`.
- No secrets.
- All definitions are governed by `docs/metrics.md`.
- Implement only the requested change.
- Run `scripts/ci.sh` and ensure it exits 0.
- Generate artifacts via `scripts/make-review-artifacts.sh`.
- Provide a short report (what changed, how verified, manual test steps if applicable).

## Work Modes
- Trigger phrases (exact): `Run PLANNED PR`, `Run MICRO PR: <one sentence description>`, `Run CONTENT ADD: <test_id>`, and `Fix code review comment`.
- `Run PLANNED PR`: use the PLANNED PR Runbook (queue-driven tasks).
- `Run MICRO PR: <one sentence description>`: use the MICRO PR Runbook (small fixes only, no tasks/QUEUE edits).
- `Run CONTENT ADD: <test_id>`: use the CONTENT ADD Runbook (no attachments).
- `Fix code review comment`: use the REVIEW FIX Runbook (Existing PR Branch).

## PLANNED PR Runbook (Default Workflow)

### Rules
- Preflight: `git status --porcelain` must be empty; if not, stop and list dirty files.
- Task selection: if `tasks/QUEUE.md` exists, pick the earliest `DOING` entry; otherwise pick the earliest `TODO` entry whose dependencies are `DONE`. Extract `PR_ID` exactly as written in QUEUE. Extract `TASK_FILE` from the `Tasks file:` line, do not guess filenames. If no selectable task exists, stop and report the first blocked `TODO` and missing dependencies.
- Read the relevant `tasks/PR-xx.md` before starting.
- Branching: `git fetch origin main`. Create a branch from `origin/main` named `BRANCH` from `TASK_FILE` if present (single source of truth); otherwise `pr-<sanitized-pr-id>` where sanitized is lowercase, `.` -> `-`, keep `[a-z0-9-]`.
- Implementation: implement exactly `TASK_FILE` scope, no extra refactors or dependency upgrades unless required. `tasks/PR-*.md` files are immutable during execution unless explicitly instructed; do not create new tasks mid-run.
- CI: single source of truth. If `scripts/ci.sh` exists, run it; else follow AGENTS-defined command; else fall back to platform scripts. Fix and rerun until exit code 0; do not claim success otherwise.
- Artifacts: always generate `artifacts/ci.log` and `artifacts/pr.patch`. Prefer `scripts/make-review-artifacts.*` if present; else specify manual commands used.
- QUEUE update: update only the `- Status:` line for the selected PR entry. Set Status to `DONE` after CI is green and before push.
- Commit/Push/PR: commit message "`<PR_ID>: <short summary>`"; push branch; open PR if `gh` is available, otherwise print manual steps.
- Final report: include `PR_ID`, `TASK_FILE`, branch, CI cmd, artifacts, commit hash, PR link or next steps.

### Checklist
- [ ] Preflight: `git status --porcelain` is empty; if not, stop and list dirty files.
- [ ] Select task from `tasks/QUEUE.md` per rules; capture `PR_ID` and `TASK_FILE`.
- [ ] Read the relevant `tasks/PR-xx.md` before starting.
- [ ] `git fetch origin main`; create a branch from `origin/main` using `BRANCH` from `TASK_FILE` if present, otherwise `pr-<sanitized-pr-id>`.
- [ ] Implement only `TASK_FILE` scope; avoid extra refactors or dependency upgrades.
- [ ] Run CI until exit 0; generate artifacts (`artifacts/ci.log`, `artifacts/pr.patch`).
- [ ] Update only the selected PR `- Status:` line in `tasks/QUEUE.md` to `DONE`.
- [ ] Commit with "`<PR_ID>: <short summary>`"; push; open PR or provide manual steps.
- [ ] Final report with required fields.

## MICRO PR Runbook

### Eligibility (all must be true)
- <= 3 files changed.
- <= 100 lines changed (excluding lockfile noise).
- No database schema/migrations.
- No dependency upgrades.
- No changes to payments/webhooks/auth/permissions.
- No large refactors or formatting-only sweeps.
- If any rule is violated, refuse MICRO and instruct to use PLANNED PR instead.

### Rules
- Do not create `tasks/PR-*.md`.
- Do not edit `tasks/QUEUE.md`.

### Checklist
- [ ] Preflight: `git status --porcelain` is empty; if not, stop and list dirty files.
- [ ] `git fetch origin main`.
- [ ] Create a branch from `origin/main` named `micro-YYYYMMDD-<short-slug>`.
- [ ] Implement the requested micro change only.
- [ ] Run CI entrypoint per PLANNED PR rules; fix until exit 0.
- [ ] Generate artifacts (`artifacts/ci.log`, `artifacts/pr.patch`, snapshot optional).
- [ ] Commit with "MICRO: <short summary>".
- [ ] Push branch; open PR if possible.
- [ ] PR description includes: `Type: MICRO`, What changed, Why, How verified (exact CI command), Artifacts paths.

## CONTENT ADD Runbook

### Rules
- Preflight: `git status --porcelain` must be empty; if not, stop and list dirty files.
- Branch name: `content-add-YYYYMMDD-<short-slug>`.
- Inputs: Markdown sources must exist in `content/sources/<test_id>/` as defined in the content sources README. Do not request attachments.
- Do not edit `tasks/QUEUE.md`.
- Do not create `tasks/PR-*.md`.
- Only modify content, catalog, and derived spec files.

### Steps
1) Validate sources exist for the test_id.
2) Run `python3 scripts/content/content_add.py --format values_compass_v1 --test-id <test_id> --tenant-id <tenant_id>` plus any required metadata flags.
3) Run `python3 scripts/content/validate_catalog.py`.
4) Run `scripts/ci.sh` until exit 0.
5) Generate artifacts via `scripts/make-review-artifacts.sh`.
6) Commit and push, open PR if possible.

## REVIEW FIX Runbook (Existing PR Branch)

### Rules
- Do not pick a new task from `tasks/QUEUE.md`.
- Do not create a new branch.
- Stay on the current branch (the PR head).
- Do not edit `tasks/QUEUE.md` and do not edit `tasks/PR-*.md`.
- Apply only changes required to address review feedback.
- Run `scripts/ci.sh` until exit code 0.
- Generate artifacts via `scripts/make-review-artifacts.sh`.
- Commit and push to the same branch.

## Tasks Stability and Queue Updates (PLANNED PR only)
- tasks/ is the source of truth. During implementation of a PR task, treat `tasks/PR-*.md` files as immutable unless explicitly instructed to change them.
- The agent must not create or modify any `tasks/PR-*.md` other than the currently selected PR task file, unless explicitly instructed.
- If the user changes tasks/ while a coding session is in progress (new files or edits), the agent must stop, explain that the task inputs changed, and ask for explicit instruction to either (a) include those changes now, or (b) revert them and proceed. The agent must not silently proceed with a moving target.
- The agent is allowed to edit `tasks/QUEUE.md` only to update Status lines for the PR being worked on and to synchronize DONE states after merges.

## Queue Status Rules (PLANNED PR only)
- When starting work on PR-XXX, set its status to DOING in `tasks/QUEUE.md`.
- Set status to DONE after CI is green and before push.

## Two Worktrees (Optional)
- To avoid unexpected changes, keep planning edits to tasks/ in a separate worktree from the implementation worktree when running long agent sessions.

## Lessons Learned (Append-Only)
- Any recurring annoyance or failure mode must be recorded here as a rule or automation idea.
- Keep entries short: Symptom -> Rule -> Automation.

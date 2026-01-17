PR-OPS-AUTOMATION-01: Codex Review Auto-Fix, Auto-Merge, and Local main Sync

Read and follow AGENTS.md strictly.

Context
- We run PRs via the queue (tasks/QUEUE.md) using the trigger phrase `Run PLANNED PR`.
- After a PR is opened, GitHub runs an automated Codex Review from the bot `chatgpt-codex-connector`.
- Today we wait manually for that review to finish and then copy-paste the feedback into Cursor to fix.
- We also merge manually and then manually sync local main in Cursor.
- Auto-merge is enabled in GitHub repo settings.

Goal
- Remove manual waiting/copy-paste for Codex Review by adding scripts that:
  - Detect and wait for the Codex Review (GitHub PR review + inline review comments) from `chatgpt-codex-connector`.
  - Export the review summary and inline comments to `artifacts/codex_review.md`.
  - If changes are needed, run a dedicated work mode (`Fix code review comment`) to apply only the requested fixes, rerun CI, regenerate artifacts, commit, and push.
- Enable hands-free merges using `gh pr merge --auto`.
- Remove the need to switch to main and click Sync in Cursor by providing a script that updates local main even when you are on another branch.

Workflow rules
- Create a new branch from main named: pr-ops-automation-01-codex-review-automerge
- Implement only what this task requests.
- Do not add new dependencies to the app runtime.
- Shell scripts must be POSIX bash, start with `#!/usr/bin/env bash`, and include `set -euo pipefail`.
- Ensure scripts are executable (`chmod +x`).
- Prefer `gh` + `jq` for API parsing. If `jq` is missing, scripts must fail with a clear message and how to install it.

Deliverables

A) Update AGENTS.md
1) Add a third trigger phrase (exact): `Fix code review comment`.
2) Add a new runbook named: REVIEW FIX Runbook (Existing PR Branch)
   - Do not pick a new task from tasks/QUEUE.md.
   - Do not create a new branch.
   - Stay on the current branch (the PR head).
   - Do not edit tasks/QUEUE.md and do not edit tasks/PR-*.md.
   - Apply only changes required to address review feedback.
   - Run scripts/ci.sh until exit code 0.
   - Generate artifacts via scripts/make-review-artifacts.sh.
   - Commit and push to the same branch.
3) Keep the existing PLANNED and MICRO behavior unchanged.

B) Add scripts
Add the following new scripts under scripts/:

1) scripts/sync-main.sh
- Purpose: update local `main` without requiring Cursor Sync.
- Behavior:
  - If current branch is main: `git pull --ff-only origin main`
  - Else: `git fetch origin main:main --prune`

2) scripts/enable-automerge.sh
- Usage: scripts/enable-automerge.sh <PR_NUMBER_OR_URL>
- Behavior: enable auto-merge using squash and delete-branch:
  - `gh pr merge <PR> --auto --squash --delete-branch`

3) scripts/wait-merged.sh
- Usage: scripts/wait-merged.sh <PR_NUMBER_OR_URL>
- Behavior: poll until PR is merged (mergedAt != null), fail if PR is closed without merge, and time out after MERGE_TIMEOUT_SEC (default 3600).

4) scripts/wait-codex-review.sh
- Usage: scripts/wait-codex-review.sh <PR_NUMBER_OR_URL>
- Purpose: wait for Codex Review completion from bot `chatgpt-codex-connector`.
- Implementation notes:
  - Use GitHub REST API via `gh api`.
  - Fetch reviews: `repos/{owner}/{repo}/pulls/{pr}/reviews` and select the latest review by `submitted_at` where `user.login == chatgpt-codex-connector`.
  - Capture: review id, state, body, commit_id.
  - Fetch inline review comments: `repos/{owner}/{repo}/pulls/{pr}/comments` filtered by `user.login == chatgpt-codex-connector` and `pull_request_review_id == <review_id>`.
  - Write a markdown report to `artifacts/codex_review.md` including:
    - PR number, bot login, review state, reviewed commit id
    - Summary (review body)
    - Inline comments list with file path and line number
  - Exit codes:
    - 0 if review is clearly OK (state APPROVED OR body contains an approval phrase AND there are 0 inline comments)
    - 1 if review exists but indicates issues (any inline comments OR non-approval body)
    - 2 if timed out or cannot resolve PR
  - Allow overrides via env vars:
    - CODEX_REVIEW_BOT_LOGIN (default chatgpt-codex-connector)
    - CODEX_REVIEW_TIMEOUT_SEC (default 1800)
    - CODEX_REVIEW_POLL_SEC (default 20)

5) scripts/fix-codex-review.sh
- Usage: scripts/fix-codex-review.sh <PR_NUMBER_OR_URL>
- Behavior:
  - Call scripts/wait-codex-review.sh.
  - If approved (exit 0), exit 0.
  - If changes requested (exit 1), run Codex CLI to apply fixes using the new work mode:
    - `codex exec --full-auto "Fix code review comment. Use artifacts/codex_review.md as the source of truth for what to change."`
  - Repeat for CODEX_REVIEW_FIX_ROUNDS rounds (default 2). If still failing, exit 1 and keep artifacts/codex_review.md.

6) scripts/pr-autopilot.sh
- Usage: scripts/pr-autopilot.sh <PR_NUMBER_OR_URL>
- Behavior:
  - Run scripts/fix-codex-review.sh <PR>
  - Enable auto-merge via scripts/enable-automerge.sh <PR>
  - Wait for merge via scripts/wait-merged.sh <PR>
  - Sync local main via scripts/sync-main.sh

7) scripts/run-planned-batch.sh
- Usage: scripts/run-planned-batch.sh <COUNT>
- Purpose: run a batch of planned PRs end-to-end so the user can start it and walk away.
- Behavior (sequential, not parallel):
  - For i from 1..COUNT:
    - Run `codex exec --full-auto "Run PLANNED PR"`
    - Determine the PR created for the current branch:
      - Prefer: `gh pr view --json number -q .number`
      - Fallback: `gh pr list --head <branch> --json number -q '.[0].number'`
    - Run scripts/pr-autopilot.sh <PR>

C) Update tasks/QUEUE.md
- Ensure a queue entry exists (idempotent). If missing, append it after the current last item; if already present, do not duplicate it and ensure fields match:
  - PR-OPS-AUTOMATION-01: Codex Review Auto-Fix + Auto-Merge + Local main Sync
  - Status: TODO
  - Tasks file: tasks/PR-OPS-AUTOMATION-01.md
  - Depends on: none

Verification
- Ensure the new scripts have `chmod +x`.
- Run `bash -n` on each new script.
- Smoke check (no network calls that change state):
  - scripts/sync-main.sh (should update without switching branches)
  - scripts/wait-codex-review.sh <existing PR> should produce artifacts/codex_review.md (use any PR that already has a Codex Review)
- State-changing check on a test PR:
  - scripts/pr-autopilot.sh <PR> should enable auto-merge and eventually merge when CI is green.

Success criteria
- AGENTS.md supports `Fix code review comment` without asking mode clarification, and it never selects a new task from tasks/QUEUE.md in that mode.
- scripts/wait-codex-review.sh reliably detects the latest Codex Review by `chatgpt-codex-connector` and exports a readable `artifacts/codex_review.md`.
- scripts/fix-codex-review.sh can iterate fixes without manual copy-paste and stops with a clear error after the configured number of rounds.
- Auto-merge is enabled by script and merges only after required checks are green.
- scripts/sync-main.sh removes the need to switch to main and click Sync in Cursor.
- scripts/run-planned-batch.sh <N> can run N planned PRs sequentially end-to-end (create PR, fix review, auto-merge, sync main) without manual intervention.

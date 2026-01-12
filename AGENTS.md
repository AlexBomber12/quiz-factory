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

## Tasks Stability and Queue Updates
- tasks/ is the source of truth. During implementation of a PR task, treat `tasks/PR-*.md` files as immutable unless explicitly instructed to change them.
- The agent must not create or modify any `tasks/PR-*.md` other than the currently selected PR task file, unless explicitly instructed.
- If the user changes tasks/ while a coding session is in progress (new files or edits), the agent must stop, explain that the task inputs changed, and ask for explicit instruction to either (a) include those changes now, or (b) revert them and proceed. The agent must not silently proceed with a moving target.
- The agent is allowed to edit `tasks/QUEUE.md` only to update Status lines for the PR being worked on and to synchronize DONE states after merges.

## Queue Status Rules
- When starting work on PR-XXX, set its status to DOING in `tasks/QUEUE.md`.
- Never set status to DONE unless you can verify the PR is merged into origin/main, because DONE is defined as merged.
- When implementation is complete and local CI is green but the PR is not merged yet, keep status as DOING and include in the final report: "Queue remains DOING until merge".

## Two Worktrees (Optional)
- To avoid unexpected changes, keep planning edits to tasks/ in a separate worktree from the implementation worktree when running long agent sessions.

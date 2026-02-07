PR-RUNNER-01: Runner Production UX (Likert 5, Progress, Resume, Accessibility)

Read and follow AGENTS.md strictly.

Context
- /t/[slug]/run exists and works, but the UI uses legacy CSS and does not support resume.
- We want a production-grade runner: mobile-first, accessible, predictable.
- We should not store raw answers server-side; local resume is enough for now.

Goal
- Upgrade the runner UI to a 1-question-per-screen flow with:
  - clear progress
  - resume and start-over
  - accessible option selection
- Keep the scoring and attempt flow unchanged.

Non-goals
- No new question types beyond existing single_choice.
- No server-side persistence of answers.
- No changes to scoring logic.

Workflow rules
- Create a new branch from main named: pr-runner-01-runner-production
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.
- Run the project test gate locally before committing.

Task A: Resume state helper
A1) Add a small local resume state module.
- Create: apps/web/src/lib/product/resume_state.ts
- Requirements:
  - Store per testId + slug.
  - Include schema version number.
  - Fields: version, test_id, slug, session_id, attempt_token, current_index, answers, updated_at_utc.
  - Provide functions:
    - loadResumeState(testId, slug)
    - saveResumeState(state)
    - clearResumeState(testId, slug)
  - Validate and sanitize on load:
    - unknown keys ignored
    - wrong types cause null
    - answers must be record of string -> string

Task B: Runner UI upgrade
B1) Refactor the client runner to shadcn/ui.
- Update: apps/web/src/app/t/[slug]/run/test-runner.tsx
- Use shadcn/ui primitives:
  - Card
  - Button
  - Separator
  - Badge
  - Progress (create if not present, or use a minimal Tailwind progress bar)

B2) Start screen behavior
- If there is a valid resume state:
  - Show 2 primary actions:
    - Continue (loads attempt, answers, and index)
    - Start over (clears resume and starts a new attempt)
- If there is no resume state:
  - Show Start test.

B3) Persist on every step
- When attempt starts, persist session_id + attempt_token.
- When an option is selected, persist answers.
- When Next/Back changes index, persist current_index.
- On successful finish (after score-preview succeeds), clear resume state.

B4) Accessibility and keyboard
- Keep a radiogroup-like experience:
  - Each option is a button with aria-checked and role=radio.
  - The list has role=radiogroup.
- Add keyboard navigation:
  - ArrowUp/ArrowDown moves selection through options.
  - Enter selects the focused option.

B5) Progress UI
- Show:
  - Progress bar (0-100)
  - "Question X / N" label

Task C: Tests
C1) Add vitest tests for resume_state.
- Create: apps/web/src/lib/product/resume_state.test.ts
- Use a small in-memory Storage shim.
- Verify:
  - roundtrip save/load works
  - invalid payload returns null
  - clear removes stored state

Success criteria
- scripts/ci.sh exits 0.
- Runner supports resume after refresh.
- Start over clears local state.
- Keyboard navigation works for options.

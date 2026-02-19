PR-REFACTOR-07: Unit Tests for Critical UI Flows (Test Runner, Paywall)

Read and follow AGENTS.md strictly.

Context
- TestRunnerClient (test-runner.tsx) is the core product component with zero test coverage.
- Paywall flow, report view, and checkout success have no component tests.
- 87 test files exist in lib/ and api routes, but component-level coverage is minimal (3 files).
- E2E covers only smoke and visual golden; no flow logic is verified.

Goal
- Add React Testing Library tests for the most critical user-facing components.
- Cover the primary happy path and key error states.
- Do not add new dependencies beyond @testing-library/react and @testing-library/jest-dom.

Workflow rules
- Branch: `pr-refactor-07-critical-ui-tests`
- Depends on: PR-REFACTOR-01 (path aliases).
- Implement only what this task requests.
- Run the project test gate locally before committing.

Task A: Install test dependencies
A1) Add to `apps/web` devDependencies:
- `@testing-library/react`
- `@testing-library/jest-dom`
- `@testing-library/user-event`
A2) Update vitest.config.ts if needed (add jsdom environment for component tests).
A3) Run `pnpm install` and commit lockfile.

Task B: TestRunnerClient tests
B1) Create `apps/web/src/app/t/[slug]/run/test-runner.test.tsx`.
B2) Test cases:
- Renders intro screen with test title and Start button.
- Empty questions: shows "no questions" message.
- Click Start: calls startAttempt API, shows first question.
- Select option: option gets selected state, Next button enables.
- Navigate forward/back: question index changes correctly.
- Resume state: when saved progress exists, shows Continue and Start Over buttons.
- Click Continue: restores previous answers and index.
- Keyboard: ArrowDown moves focus between options.
- Finish: calls completeAttempt and score-preview, then redirects.
- Network error on start: shows error banner.
- Network error on finish: shows error banner, does not redirect.
B3) Mock:
- `fetch` for all API calls (startAttempt, completeAttempt, score-preview).
- `useRouter` from next/navigation.
- `localStorage` for resume state.

Task C: Paywall component tests
C1) Create `apps/web/src/app/t/[slug]/pay/paywall-client.test.tsx`.
C2) Test cases:
- Renders paywall headline and price.
- Click purchase button triggers checkout.
- Loading state while checkout session is created.
- Error state if checkout creation fails.
C3) Mock fetch for checkout API calls.

Task D: Verification
D1) `pnpm test` passes including all new tests.
D2) `pnpm typecheck` passes.
D3) `scripts/ci.sh --scope app` exits 0.
D4) New test files follow existing naming convention (*.test.tsx co-located with source).

Success criteria
- TestRunnerClient has 10+ test cases covering primary flow.
- Paywall has 4+ test cases.
- All existing tests still pass.
- `scripts/ci.sh --scope app` exits 0.

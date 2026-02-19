PR-REFACTOR-04: API Route Guards Wrapper (withApiGuards)

Read and follow AGENTS.md strictly.

Context
- Every public API route repeats the same guard chain:
  `assertAllowedMethod -> assertAllowedHostAsync -> assertAllowedOriginAsync -> rateLimit -> assertMaxBodyBytes`
- This boilerplate exists in ~15 route files.
- Missing a guard in a new route creates a security vulnerability.
- The pattern is error-prone and hard to audit.

Goal
- Create a `withApiGuards()` wrapper that applies all standard guards.
- Migrate all public API routes to use it.
- Make it impossible to forget a guard when adding new routes.

Workflow rules
- Branch: `pr-refactor-04-api-guards-wrapper`
- Depends on: PR-REFACTOR-01 (path aliases) and PR-REFACTOR-02 (shared utils).
- Implement only what this task requests.
- Run the project test gate locally before committing.

Task A: Create the wrapper
A1) Create `apps/web/src/lib/security/with_api_guards.ts`.
A2) Implement `withApiGuards()`:
```typescript
type GuardedRouteOptions = {
  methods: string[];
  rateLimit?: RateLimitOptions;       // default: DEFAULT_EVENT_RATE_LIMIT
  maxBodyBytes?: number;              // default: DEFAULT_EVENT_BODY_BYTES
  requireHost?: boolean;              // default: true
  requireOrigin?: boolean;            // default: true
  async?: boolean;                    // default: true (use async host/origin checks)
};

type GuardedHandler = (request: Request) => Promise<Response>;

export function withApiGuards(
  handler: GuardedHandler,
  options: GuardedRouteOptions
): (request: Request) => Promise<Response>;
```
A3) The wrapper must:
- Run guards in order: method -> host -> origin -> rateLimit -> maxBodyBytes.
- Return the first non-null guard response (short-circuit).
- Call the handler only if all guards pass.
- Support both sync and async host/origin checks.
A4) Export types and the wrapper from the module.

Task B: Tests for wrapper
B1) Create `apps/web/src/lib/security/with_api_guards.test.ts`.
B2) Test:
- Allowed request passes through to handler.
- Wrong method returns 405.
- Unknown host returns 403.
- Rate limit exceeded returns 429.
- Body too large returns 413.
- Guards execute in correct order (short-circuit on first failure).

Task C: Migrate public API routes
C1) Identify all route files under `apps/web/src/app/api/` that currently call the guard functions manually.
C2) Replace the guard boilerplate with `withApiGuards()`:
```typescript
// Before:
export const POST = async (request: Request) => {
  const methodResponse = assertAllowedMethod(request, ["POST"]);
  if (methodResponse) return methodResponse;
  const hostResponse = await assertAllowedHostAsync(request);
  if (hostResponse) return hostResponse;
  // ... more guards ...
  return handleAnalyticsEvent(request, { event: "test_start" });
};

// After:
export const POST = withApiGuards(
  (request) => handleAnalyticsEvent(request, { event: "test_start", createSession: true, issueAttemptToken: true }),
  { methods: ["POST"] }
);
```
C3) Do NOT migrate admin API routes (they have their own auth middleware).
C4) Do NOT change route behavior or response codes.

Task D: Verification
D1) `pnpm typecheck` passes.
D2) `pnpm test` passes (including new wrapper tests).
D3) `pnpm build` succeeds.
D4) `scripts/ci.sh --scope app` exits 0.
D5) Manually verify: the existing e2e smoke test still passes (`pnpm e2e` if available).

Success criteria
- Zero manual guard chains remain in public API routes.
- All public routes use `withApiGuards()`.
- Admin routes are untouched.
- All existing tests pass.
- `scripts/ci.sh --scope app` exits 0.

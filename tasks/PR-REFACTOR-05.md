PR-REFACTOR-05: Structured Logging (Replace empty catch blocks)

Read and follow AGENTS.md strictly.

Context
- The codebase has 120 empty `catch {}` blocks and only 3 `console.error` calls across 65K lines.
- No logging library is installed.
- In production, errors are invisible -- no way to diagnose incidents.
- Empty catch blocks silently swallow errors in critical paths (Stripe webhooks, DB queries, analytics).

Goal
- Add a lightweight structured logger.
- Replace all empty catch blocks with contextual log statements.
- Ensure JSON output in production, pretty output in dev.

Workflow rules
- Branch: `pr-refactor-05-structured-logging`
- Depends on: PR-REFACTOR-01 (path aliases) and PR-REFACTOR-03 (env module).
- Implement only what this task requests.
- Run the project test gate locally before committing.

Task A: Create logger module
A1) Create `apps/web/src/lib/logger.ts`.
A2) Implement a lightweight logger (do NOT add pino or winston as dependency to keep bundle small):
```typescript
type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

export const logger = {
  debug(context: LogContext, message: string): void;
  info(context: LogContext, message: string): void;
  warn(context: LogContext, message: string): void;
  error(context: LogContext, message: string): void;
};
```
A3) Implementation rules:
- In production (`NODE_ENV === "production"`): output JSON to stdout, one line per log.
- In development: output human-readable format with colors.
- In test (`NODE_ENV === "test"`): suppress output (or respect LOG_LEVEL env var).
- Each log entry includes: `timestamp`, `level`, `message`, and spread context.
- The `error` context field should serialize Error objects (message + stack).
A4) Create `apps/web/src/lib/logger.test.ts` with basic tests:
- Correct JSON structure in production mode.
- Error serialization works.
- Log level filtering works.

Task B: Replace empty catch blocks
B1) Find all `catch {` and `catch (_)` blocks in `apps/web/src/` that have empty or no-op bodies.
B2) For each, determine the appropriate log level based on context:
- `logger.warn` for recoverable situations (cache miss, fallback to default, optional feature unavailable).
- `logger.error` for unexpected failures (DB query failed, external API error, crypto operation failed).
B3) Add a descriptive message based on the surrounding code context. Examples:
```typescript
// Before:
} catch {
  // If DB lookup fails we degrade to a slug fallback
}

// After:
} catch (error) {
  logger.warn({ error, host }, "Tenant DB lookup failed, falling back to slug");
}
```
B4) Do NOT change the control flow -- if the catch was swallowing an error, keep swallowing it but log it.
B5) Replace any bare `console.error` or `console.log` with the logger.

Task C: Add request context helper
C1) Create `apps/web/src/lib/logger_context.ts`:
```typescript
export function requestContext(request: Request): LogContext {
  return {
    method: request.method,
    url: request.url,
    // Do NOT log headers, cookies, or body
  };
}
```
C2) Use `requestContext()` in API route catch blocks where a request object is available.

Task D: Verification
D1) `grep -rn "catch {" apps/web/src/ | grep -v test` returns zero results.
D2) `grep -rn "console\.\(log\|error\|warn\)" apps/web/src/ | grep -v test | grep -v logger` returns zero results.
D3) `pnpm typecheck` passes.
D4) `pnpm test` passes.
D5) `pnpm build` succeeds.
D6) `scripts/ci.sh --scope app` exits 0.

Success criteria
- Zero empty catch blocks remain in production code.
- Zero bare console.* calls remain in production code.
- All logging goes through the structured logger.
- JSON output verified in production mode.
- `scripts/ci.sh --scope app` exits 0.

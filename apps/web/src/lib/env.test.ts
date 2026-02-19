import { afterEach, describe, expect, it } from "vitest";

import { validateEnv } from "./env";

const REQUIRED_IN_PRODUCTION = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "ADMIN_SESSION_SECRET",
  "ATTEMPT_TOKEN_SECRET",
  "RESULT_COOKIE_SECRET",
  "REPORT_TOKEN_SECRET",
  "RATE_LIMIT_SALT"
] as const;

const TRACKED_ENV = [
  "NODE_ENV",
  "NEXT_PHASE",
  ...REQUIRED_IN_PRODUCTION
] as const;

const ORIGINAL_ENV = Object.fromEntries(
  TRACKED_ENV.map((key) => [key, process.env[key]])
) as Record<(typeof TRACKED_ENV)[number], string | undefined>;

const setEnv = (key: string, value: string | undefined): void => {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
};

const clearRequiredProductionEnv = (): void => {
  for (const key of REQUIRED_IN_PRODUCTION) {
    setEnv(key, undefined);
  }
};

const restoreEnv = (): void => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    setEnv(key, value);
  }
};

describe("validateEnv cache invalidation", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("re-validates when NODE_ENV changes", () => {
    setEnv("NODE_ENV", "development");
    setEnv("NEXT_PHASE", undefined);
    clearRequiredProductionEnv();

    expect(() => validateEnv()).not.toThrow();

    setEnv("NODE_ENV", "production");
    expect(() => validateEnv()).toThrowError(
      "[env] Missing required environment variables in production:"
    );
  });

  it("re-validates when NEXT_PHASE changes", () => {
    setEnv("NODE_ENV", "production");
    setEnv("NEXT_PHASE", "phase-production-build");
    clearRequiredProductionEnv();

    expect(() => validateEnv()).not.toThrow();

    setEnv("NEXT_PHASE", undefined);
    expect(() => validateEnv()).toThrowError(
      "[env] Missing required environment variables in production:"
    );
  });
});

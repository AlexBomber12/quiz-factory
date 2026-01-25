import { afterEach, describe, expect, it } from "vitest";

import { assertStripeEnvConfigured, resetStripeEnvValidationState } from "./env";

const ORIGINAL_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PHASE: process.env.NEXT_PHASE,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET
};

const setEnv = (key: string, value: string | undefined): void => {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
};

const restoreEnv = (): void => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    setEnv(key, value);
  }
};

describe("Stripe env validation", () => {
  afterEach(() => {
    restoreEnv();
    resetStripeEnvValidationState();
  });

  it("does not validate outside production", () => {
    setEnv("NODE_ENV", "test");
    setEnv("STRIPE_SECRET_KEY", undefined);
    setEnv("STRIPE_WEBHOOK_SECRET", undefined);

    expect(() =>
      assertStripeEnvConfigured({
        context: "/api/stripe/webhook",
        required: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]
      })
    ).not.toThrow();
  });

  it("fails fast in production when required vars are missing", () => {
    setEnv("NODE_ENV", "production");
    setEnv("NEXT_PHASE", undefined);
    setEnv("STRIPE_SECRET_KEY", undefined);
    setEnv("STRIPE_WEBHOOK_SECRET", undefined);

    expect(() =>
      assertStripeEnvConfigured({
        context: "/api/stripe/webhook",
        required: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]
      })
    ).toThrowError(
      "[Stripe env] Missing required environment variables for /api/stripe/webhook: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET"
    );
  });

  it("skips validation during the production build phase", () => {
    setEnv("NODE_ENV", "production");
    setEnv("NEXT_PHASE", "phase-production-build");
    setEnv("STRIPE_SECRET_KEY", undefined);
    setEnv("STRIPE_WEBHOOK_SECRET", undefined);

    expect(() =>
      assertStripeEnvConfigured({
        context: "/api/stripe/webhook",
        required: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]
      })
    ).not.toThrow();
  });
});

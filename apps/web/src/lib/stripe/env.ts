import { validateEnv } from "@/lib/env";

const PRODUCTION_BUILD_PHASE = "phase-production-build";

const normalizeEnv = (value: string | undefined): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const shouldValidateStripeEnv = (): boolean => {
  if (process.env.NODE_ENV !== "production") {
    return false;
  }

  if (process.env.NEXT_PHASE === PRODUCTION_BUILD_PHASE) {
    return false;
  }

  return true;
};

const validatedContexts = new Set<string>();

export const assertStripeEnvConfigured = (options: {
  context: string;
  required: readonly string[];
}): void => {
  if (!shouldValidateStripeEnv()) {
    return;
  }

  if (validatedContexts.has(options.context)) {
    return;
  }

  const resolvedEnv = validateEnv({ enforceProductionRequirements: false });
  const missing = options.required.filter((name) =>
    !normalizeEnv(resolvedEnv[name as keyof typeof resolvedEnv])
  );
  if (missing.length > 0) {
    throw new Error(
      `[Stripe env] Missing required environment variables for ${options.context}: ${missing.join(
        ", "
      )}`
    );
  }

  validatedContexts.add(options.context);
};

export const resetStripeEnvValidationState = (): void => {
  validatedContexts.clear();
};

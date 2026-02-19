import { ZodError, z } from "zod";

type ProcessEnv = Record<string, string | undefined>;

const PRODUCTION_BUILD_PHASE = "phase-production-build";

const normalizeOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const optionalString = () =>
  z.preprocess((value) => normalizeOptionalString(value), z.string().optional());

const normalizedEnum = <T extends readonly [string, ...string[]]>(
  values: T,
  fallback: T[number]
) =>
  z.preprocess(
    (value) => normalizeOptionalString(value)?.toLowerCase() ?? fallback,
    z.enum(values)
  );

const serverEnvSchema = z.object({
  ADMIN_ANALYTICS_MODE: optionalString(),
  ADMIN_IMPORT_LOCALE_ALLOWLIST_REGEX: optionalString(),
  ADMIN_REQUIRE_STAGING_PUBLISH: optionalString(),
  ADMIN_SESSION_SECRET: optionalString(),
  ADMIN_STAGING_TENANT_ALLOWLIST: optionalString(),
  ADMIN_TOKEN: optionalString(),
  ALERTS_RUNNER_SECRET: optionalString(),
  ATTEMPT_TOKEN_SECRET: optionalString(),
  ATTEMPT_TOKEN_TTL_SECONDS: optionalString(),
  BIGQUERY_PROJECT_ID: optionalString(),
  BIGQUERY_RAW_COSTS_DATASET: optionalString(),
  BIGQUERY_STRIPE_DATASET: optionalString(),
  BIGQUERY_TMP_DATASET: optionalString(),
  COMMIT_SHA: optionalString(),
  CONTENT_DATABASE_URL: optionalString(),
  CONTENT_SOURCE: normalizedEnum(["fs", "db"], "fs"),
  EDITOR_TOKEN: optionalString(),
  EXTRA_ALLOWED_HOSTS: optionalString(),
  GCP_PROJECT: optionalString(),
  GOOGLE_APPLICATION_CREDENTIALS: optionalString(),
  GOOGLE_CLOUD_PROJECT: optionalString(),
  OPENAI_API_KEY: optionalString(),
  OPENAI_BASE_URL: z.preprocess(
    (value) => normalizeOptionalString(value),
    z.string().url().optional()
  ),
  OPENAI_MODEL: optionalString(),
  PAGE_VIEW_SAMPLE_RATE: optionalString(),
  POSTHOG_HOST: optionalString(),
  POSTHOG_SERVER_KEY: optionalString(),
  RATE_LIMIT_ENABLED: optionalString(),
  RATE_LIMIT_MAX_REQUESTS: optionalString(),
  RATE_LIMIT_SALT: optionalString(),
  RATE_LIMIT_WINDOW_SECONDS: optionalString(),
  REPORT_PDF_CACHE_DIR: optionalString(),
  REPORT_PDF_CACHE_TTL_SECONDS: optionalString(),
  REPORT_PDF_MODE: optionalString(),
  REPORT_PDF_RENDER_TIMEOUT_MS: optionalString(),
  REPORT_PDF_TEMPLATE_VERSION: optionalString(),
  REPORT_TOKEN_SECRET: optionalString(),
  REPORT_WORKER_SECRET: optionalString(),
  RESULT_COOKIE_SECRET: optionalString(),
  STRIPE_PRICE_PACK10_EUR: optionalString(),
  STRIPE_PRICE_PACK5_EUR: optionalString(),
  STRIPE_PRICE_SINGLE_BASE_299_EUR: optionalString(),
  STRIPE_PRICE_SINGLE_INTRO_149_EUR: optionalString(),
  STRIPE_SECRET_KEY: optionalString(),
  STRIPE_WEBHOOK_SECRET: optionalString(),
  STUDIO_ENABLED: optionalString(),
  TENANTS_SOURCE: normalizedEnum(["file", "db"], "file"),
  TRUST_X_FORWARDED_HOST: optionalString()
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = Record<`NEXT_PUBLIC_${string}`, string | undefined>;
export type Env = ServerEnv & ClientEnv;
export type ValidateEnvOptions = {
  enforceProductionRequirements?: boolean;
};

const SERVER_ENV_KEYS = Object.keys(serverEnvSchema.shape) as Array<keyof ServerEnv>;
const REQUIRED_IN_PRODUCTION: ReadonlyArray<keyof ServerEnv> = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "ADMIN_SESSION_SECRET",
  "ATTEMPT_TOKEN_SECRET",
  "RESULT_COOKIE_SECRET",
  "REPORT_TOKEN_SECRET",
  "RATE_LIMIT_SALT"
];

let cachedStrictEnv: Env | null = null;
let cachedLenientEnv: Env | null = null;
let cachedSnapshot = "";

const shouldEnforceProductionRequirements = (): boolean => {
  if (process.env.NODE_ENV !== "production") {
    return false;
  }

  if (process.env.NEXT_PHASE === PRODUCTION_BUILD_PHASE) {
    return false;
  }

  return true;
};

const collectClientEnv = (rawEnv: ProcessEnv): ClientEnv => {
  const entries = Object.entries(rawEnv).filter(([key]) =>
    key.startsWith("NEXT_PUBLIC_")
  );

  return Object.fromEntries(
    entries.map(([key, value]) => [key, normalizeOptionalString(value)])
  ) as ClientEnv;
};

const buildEnvSnapshot = (rawEnv: ProcessEnv): string => {
  const serverSnapshot = SERVER_ENV_KEYS.map(
    (key) => `${key}=${rawEnv[key] ?? ""}`
  ).join("\n");
  const clientSnapshot = Object.entries(rawEnv)
    .filter(([key]) => key.startsWith("NEXT_PUBLIC_"))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value ?? ""}`)
    .join("\n");

  return `${serverSnapshot}\n${clientSnapshot}`;
};

const parseServerEnv = (
  rawEnv: ProcessEnv,
  enforceProductionRequirements: boolean
): ServerEnv => {
  try {
    const parsed = serverEnvSchema.parse(rawEnv);
    if (!enforceProductionRequirements || !shouldEnforceProductionRequirements()) {
      return parsed;
    }

    const missing = REQUIRED_IN_PRODUCTION.filter((name) => !parsed[name]);
    if (missing.length > 0) {
      throw new Error(
        `[env] Missing required environment variables in production: ${missing.join(", ")}`
      );
    }

    return parsed;
  } catch (error) {
    if (error instanceof ZodError) {
      const details = error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      throw new Error(`[env] Invalid environment configuration: ${details}`);
    }

    throw error;
  }
};

const resolveValidatedEnv = (enforceProductionRequirements: boolean): Env => {
  const snapshot = buildEnvSnapshot(process.env);
  if (cachedSnapshot !== snapshot) {
    cachedSnapshot = snapshot;
    cachedStrictEnv = null;
    cachedLenientEnv = null;
  }

  if (enforceProductionRequirements && cachedStrictEnv) {
    return cachedStrictEnv;
  }

  if (!enforceProductionRequirements && cachedLenientEnv) {
    return cachedLenientEnv;
  }

  const parsed = {
    ...parseServerEnv(process.env, enforceProductionRequirements),
    ...collectClientEnv(process.env)
  };

  if (enforceProductionRequirements) {
    cachedStrictEnv = parsed;
  } else {
    cachedLenientEnv = parsed;
  }

  return parsed;
};

export const validateEnv = (options: ValidateEnvOptions = {}): Env => {
  const enforceProductionRequirements = options.enforceProductionRequirements ?? true;
  return resolveValidatedEnv(enforceProductionRequirements);
};

export const env = new Proxy({} as Env, {
  get(_target, prop: string | symbol): unknown {
    const resolved = validateEnv();
    return Reflect.get(resolved, prop);
  },
  has(_target, prop: string | symbol): boolean {
    return prop in validateEnv();
  },
  ownKeys(): ArrayLike<string | symbol> {
    return Reflect.ownKeys(validateEnv());
  },
  getOwnPropertyDescriptor(_target, prop: string | symbol): PropertyDescriptor | undefined {
    const resolved = validateEnv();
    if (!(prop in resolved)) {
      return undefined;
    }

    return {
      configurable: true,
      enumerable: true,
      writable: false,
      value: Reflect.get(resolved, prop)
    };
  }
}) as Env;

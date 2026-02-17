import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  assertAllowedHost,
  assertAllowedHostAsync,
  assertAllowedOrigin,
  assertAllowedOriginAsync,
  rateLimit,
  resetRateLimitState
} from "./request_guards";

const ENV_KEYS = [
  "RATE_LIMIT_ENABLED",
  "RATE_LIMIT_MAX_REQUESTS",
  "RATE_LIMIT_WINDOW_SECONDS",
  "RATE_LIMIT_SALT",
  "TRUST_X_FORWARDED_HOST",
  "NODE_ENV",
  "EXTRA_ALLOWED_HOSTS",
  "TENANTS_SOURCE"
] as const;

const setEnv = (key: (typeof ENV_KEYS)[number], value: string | undefined): void => {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) {
    delete env[key];
  } else {
    env[key] = value;
  }
};

const buildRequest = (headers?: Record<string, string>): Request => {
  return new Request("https://tenant.example.com/api/page/view", {
    method: "POST",
    headers
  });
};

describe("request guards", () => {
  let envSnapshot: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>;

  beforeEach(() => {
    envSnapshot = {};
    for (const key of ENV_KEYS) {
      envSnapshot[key] = process.env[key];
      setEnv(key, undefined);
    }
    resetRateLimitState();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = envSnapshot[key];
      setEnv(key, value);
    }
    resetRateLimitState();
  });

  it("allows known hosts", () => {
    const response = assertAllowedHost(buildRequest({ host: "tenant.example.com" }));
    expect(response).toBeNull();
  });

  it("allows known hosts via async guard in file mode", async () => {
    const response = await assertAllowedHostAsync(
      buildRequest({ host: "tenant.example.com" })
    );
    expect(response).toBeNull();
  });

  it("blocks unknown hosts", () => {
    const response = assertAllowedHost(buildRequest({ host: "blocked.example.com" }));
    expect(response?.status).toBe(403);
  });

  it("allows localhost in dev mode", () => {
    setEnv("NODE_ENV", "development");

    const response = assertAllowedHost(buildRequest({ host: "localhost:3000" }));
    expect(response).toBeNull();
  });

  it("allows localhost origins in dev mode", () => {
    setEnv("NODE_ENV", "development");

    const response = assertAllowedOrigin(
      buildRequest({ origin: "http://localhost:3000" })
    );
    expect(response).toBeNull();
  });

  it("allows extra hosts in dev mode", () => {
    setEnv("NODE_ENV", "development");
    setEnv("EXTRA_ALLOWED_HOSTS", "extra.example.com,internal.example.com:8080");

    const response = assertAllowedHost(
      buildRequest({ host: "internal.example.com:8080" })
    );
    expect(response).toBeNull();
  });

  it("blocks missing origins in production mode", () => {
    setEnv("NODE_ENV", "production");

    const response = assertAllowedOrigin(buildRequest());
    expect(response?.status).toBe(403);
  });

  it("ignores x-forwarded-host by default", () => {
    const response = assertAllowedHost(
      buildRequest({
        host: "blocked.example.com",
        "x-forwarded-host": "tenant.example.com"
      })
    );

    expect(response?.status).toBe(403);
  });

  it("allows trusted x-forwarded-host", () => {
    process.env.TRUST_X_FORWARDED_HOST = "true";

    const response = assertAllowedHost(
      buildRequest({
        host: "blocked.example.com",
        "x-forwarded-host": "tenant.example.com"
      })
    );

    expect(response).toBeNull();
  });

  it("allows known origins", () => {
    const response = assertAllowedOrigin(
      buildRequest({ origin: "https://tenant.example.com" })
    );
    expect(response).toBeNull();
  });

  it("allows known origins via async guard in file mode", async () => {
    const response = await assertAllowedOriginAsync(
      buildRequest({ origin: "https://tenant.example.com" })
    );
    expect(response).toBeNull();
  });

  it("blocks unknown origins", () => {
    const response = assertAllowedOrigin(
      buildRequest({ origin: "https://blocked.example.com" })
    );
    expect(response?.status).toBe(403);
  });

  it("rate limits after the threshold", () => {
    const request = buildRequest({ cookie: "qf_distinct_id=limit-test" });
    const options = { windowSeconds: 60, maxRequests: 2 };

    expect(rateLimit(request, options)).toBeNull();
    expect(rateLimit(request, options)).toBeNull();
    const response = rateLimit(request, options);

    expect(response?.status).toBe(429);
  });
});

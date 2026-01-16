import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  assertAllowedHost,
  assertAllowedOrigin,
  rateLimit,
  resetRateLimitState
} from "./request_guards";

const ENV_KEYS = [
  "RATE_LIMIT_ENABLED",
  "RATE_LIMIT_MAX_REQUESTS",
  "RATE_LIMIT_WINDOW_SECONDS",
  "RATE_LIMIT_SALT"
] as const;

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
      delete process.env[key];
    }
    resetRateLimitState();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = envSnapshot[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    resetRateLimitState();
  });

  it("allows known hosts", () => {
    const response = assertAllowedHost(buildRequest({ host: "tenant.example.com" }));
    expect(response).toBeNull();
  });

  it("blocks unknown hosts", () => {
    const response = assertAllowedHost(buildRequest({ host: "blocked.example.com" }));
    expect(response?.status).toBe(403);
  });

  it("allows known origins", () => {
    const response = assertAllowedOrigin(
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

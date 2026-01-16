import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetRateLimitState } from "../../lib/security/request_guards";

import { POST as pageView } from "./page/view/route";

const ENV_KEYS = [
  "RATE_LIMIT_ENABLED",
  "RATE_LIMIT_MAX_REQUESTS",
  "RATE_LIMIT_WINDOW_SECONDS"
] as const;

const buildRequest = (
  host: string,
  body: Record<string, unknown>,
  cookie?: string
): Request => {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    host
  };
  if (cookie) {
    headers.cookie = cookie;
  }

  return new Request(`https://${host}/api/page/view`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
};

describe("request guard integration", () => {
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

  it("blocks requests from unknown hosts", async () => {
    const response = await pageView(
      buildRequest("blocked.example.com", { session_id: "session-123" })
    );

    expect([403, 404]).toContain(response.status);
  });

  it("rate limits repeated requests", async () => {
    process.env.RATE_LIMIT_ENABLED = "true";
    process.env.RATE_LIMIT_MAX_REQUESTS = "2";
    process.env.RATE_LIMIT_WINDOW_SECONDS = "60";

    const cookie = "qf_distinct_id=rate-limit-user";
    const body = { session_id: "session-123" };

    const first = await pageView(buildRequest("tenant.example.com", body, cookie));
    expect(first.status).toBe(200);

    const second = await pageView(buildRequest("tenant.example.com", body, cookie));
    expect(second.status).toBe(200);

    const third = await pageView(buildRequest("tenant.example.com", body, cookie));
    expect(third.status).toBe(429);
  });
});

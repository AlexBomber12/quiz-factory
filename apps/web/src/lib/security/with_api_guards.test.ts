import { beforeEach, describe, expect, it, vi } from "vitest";

const requestGuardMocks = vi.hoisted(() => ({
  assertAllowedMethod: vi.fn(),
  assertAllowedHost: vi.fn(),
  assertAllowedOrigin: vi.fn(),
  assertAllowedHostAsync: vi.fn(),
  assertAllowedOriginAsync: vi.fn(),
  rateLimit: vi.fn(),
  assertMaxBodyBytes: vi.fn()
}));

vi.mock("./request_guards", () => ({
  DEFAULT_EVENT_BODY_BYTES: 32 * 1024,
  DEFAULT_EVENT_RATE_LIMIT: {
    windowSeconds: 60,
    maxRequests: 60
  },
  assertAllowedMethod: requestGuardMocks.assertAllowedMethod,
  assertAllowedHost: requestGuardMocks.assertAllowedHost,
  assertAllowedOrigin: requestGuardMocks.assertAllowedOrigin,
  assertAllowedHostAsync: requestGuardMocks.assertAllowedHostAsync,
  assertAllowedOriginAsync: requestGuardMocks.assertAllowedOriginAsync,
  rateLimit: requestGuardMocks.rateLimit,
  assertMaxBodyBytes: requestGuardMocks.assertMaxBodyBytes
}));

import { withApiGuards } from "./with_api_guards";

const buildRequest = (): Request => {
  return new Request("https://tenant.example.com/api/test/start", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ ok: true })
  });
};

const buildResponse = (status: number): Response => {
  return new Response(null, { status });
};

describe("withApiGuards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestGuardMocks.assertAllowedMethod.mockReturnValue(null);
    requestGuardMocks.assertAllowedHost.mockReturnValue(null);
    requestGuardMocks.assertAllowedOrigin.mockReturnValue(null);
    requestGuardMocks.assertAllowedHostAsync.mockResolvedValue(null);
    requestGuardMocks.assertAllowedOriginAsync.mockResolvedValue(null);
    requestGuardMocks.rateLimit.mockReturnValue(null);
    requestGuardMocks.assertMaxBodyBytes.mockResolvedValue(null);
  });

  it("allows request through to handler", async () => {
    const handler = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const route = withApiGuards(handler, { methods: ["POST"] });
    const request = buildRequest();

    const response = await route(request);

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(request);
    expect(requestGuardMocks.assertAllowedMethod).toHaveBeenCalledWith(request, ["POST"]);
    expect(requestGuardMocks.assertAllowedHostAsync).toHaveBeenCalledWith(request);
    expect(requestGuardMocks.assertAllowedOriginAsync).toHaveBeenCalledWith(request);
    expect(requestGuardMocks.rateLimit).toHaveBeenCalledWith(request, {
      windowSeconds: 60,
      maxRequests: 60
    });
    expect(requestGuardMocks.assertMaxBodyBytes).toHaveBeenCalledWith(request, 32 * 1024);
  });

  it("returns 405 when method guard fails", async () => {
    requestGuardMocks.assertAllowedMethod.mockReturnValue(buildResponse(405));
    const handler = vi.fn(async () => buildResponse(200));
    const route = withApiGuards(handler, { methods: ["POST"] });

    const response = await route(buildRequest());

    expect(response.status).toBe(405);
    expect(handler).not.toHaveBeenCalled();
    expect(requestGuardMocks.assertAllowedHostAsync).not.toHaveBeenCalled();
  });

  it("returns 403 when host guard fails", async () => {
    requestGuardMocks.assertAllowedHostAsync.mockResolvedValue(buildResponse(403));
    const handler = vi.fn(async () => buildResponse(200));
    const route = withApiGuards(handler, { methods: ["POST"] });

    const response = await route(buildRequest());

    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
    expect(requestGuardMocks.assertAllowedOriginAsync).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limit guard fails", async () => {
    requestGuardMocks.rateLimit.mockReturnValue(buildResponse(429));
    const handler = vi.fn(async () => buildResponse(200));
    const route = withApiGuards(handler, { methods: ["POST"] });

    const response = await route(buildRequest());

    expect(response.status).toBe(429);
    expect(handler).not.toHaveBeenCalled();
    expect(requestGuardMocks.assertMaxBodyBytes).not.toHaveBeenCalled();
  });

  it("returns 413 when body size guard fails", async () => {
    requestGuardMocks.assertMaxBodyBytes.mockResolvedValue(buildResponse(413));
    const handler = vi.fn(async () => buildResponse(200));
    const route = withApiGuards(handler, { methods: ["POST"] });

    const response = await route(buildRequest());

    expect(response.status).toBe(413);
    expect(handler).not.toHaveBeenCalled();
  });

  it("executes guards in order and short-circuits", async () => {
    const calls: string[] = [];
    const forbidden = buildResponse(403);

    requestGuardMocks.assertAllowedMethod.mockImplementation(() => {
      calls.push("method");
      return null;
    });
    requestGuardMocks.assertAllowedHostAsync.mockImplementation(async () => {
      calls.push("host");
      return null;
    });
    requestGuardMocks.assertAllowedOriginAsync.mockImplementation(async () => {
      calls.push("origin");
      return forbidden;
    });
    requestGuardMocks.rateLimit.mockImplementation(() => {
      calls.push("rate");
      return null;
    });
    requestGuardMocks.assertMaxBodyBytes.mockImplementation(async () => {
      calls.push("body");
      return null;
    });

    const handler = vi.fn(async () => {
      calls.push("handler");
      return buildResponse(200);
    });
    const route = withApiGuards(handler, { methods: ["POST"] });

    const response = await route(buildRequest());

    expect(response.status).toBe(403);
    expect(calls).toEqual(["method", "host", "origin"]);
    expect(handler).not.toHaveBeenCalled();
  });
});

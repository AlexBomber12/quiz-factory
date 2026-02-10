import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { normalizeHostname, resolveEffectiveHost } from "./request_host";

describe("request host helpers", () => {
  let trustForwardedHostSnapshot: string | undefined;

  beforeEach(() => {
    trustForwardedHostSnapshot = process.env.TRUST_X_FORWARDED_HOST;
    delete process.env.TRUST_X_FORWARDED_HOST;
  });

  afterEach(() => {
    if (trustForwardedHostSnapshot === undefined) {
      delete process.env.TRUST_X_FORWARDED_HOST;
      return;
    }

    process.env.TRUST_X_FORWARDED_HOST = trustForwardedHostSnapshot;
  });

  it("normalizes host header values by stripping ports", () => {
    expect(normalizeHostname("quizfactory.lan:3000")).toBe("quizfactory.lan");
  });

  it("normalizes trusted x-forwarded-host values by stripping ports", () => {
    process.env.TRUST_X_FORWARDED_HOST = "true";

    const resolvedHost = resolveEffectiveHost(
      new Headers({
        host: "blocked.example.com",
        "x-forwarded-host": "quizfactory.lan:3000"
      })
    );

    expect(resolvedHost).toBe("quizfactory.lan");
  });
});

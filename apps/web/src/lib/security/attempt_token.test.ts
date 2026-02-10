import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertAttemptTokenMatchesContext,
  issueAttemptToken,
  verifyAttemptToken
} from "./attempt_token";
import { resolveTenant } from "../tenants/resolve";

describe("attempt token", () => {
  beforeEach(() => {
    process.env.ATTEMPT_TOKEN_SECRET = "test-attempt-secret";
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.ATTEMPT_TOKEN_SECRET;
  });

  it("issues and verifies tokens", () => {
    const token = issueAttemptToken(
      {
        tenant_id: "tenant-1",
        session_id: "session-1",
        distinct_id: "distinct-1"
      },
      60
    );

    const payload = verifyAttemptToken(token);
    expect(payload.tenant_id).toBe("tenant-1");
    expect(payload.session_id).toBe("session-1");
    expect(payload.distinct_id).toBe("distinct-1");
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("rejects expired tokens", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));

    const token = issueAttemptToken(
      {
        tenant_id: "tenant-1",
        session_id: "session-1",
        distinct_id: "distinct-1"
      },
      1
    );

    vi.setSystemTime(new Date("2024-01-01T00:00:02Z"));
    expect(() => verifyAttemptToken(token)).toThrow("Attempt token has expired.");
  });

  it("rejects mismatched context", () => {
    const token = issueAttemptToken(
      {
        tenant_id: "tenant-1",
        session_id: "session-1",
        distinct_id: "distinct-1"
      },
      60
    );
    const payload = verifyAttemptToken(token);

    expect(() =>
      assertAttemptTokenMatchesContext(payload, {
        tenant_id: "tenant-2",
        session_id: "session-1",
        distinct_id: "distinct-1"
      })
    ).toThrow("Attempt token does not match request context.");

    expect(() =>
      assertAttemptTokenMatchesContext(payload, {
        tenant_id: "tenant-1",
        session_id: "session-1",
        distinct_id: "distinct-2"
      })
    ).toThrow("Attempt token does not match request context.");
  });

  it("resolves the same tenant_id for hostnames with and without ports", () => {
    const withoutPort = resolveTenant(new Headers({ host: "quizfactory.lan" }));
    const withPort = resolveTenant(new Headers({ host: "quizfactory.lan:3000" }));

    expect(withoutPort.tenantId).toBe(withPort.tenantId);
  });

  it("validates attempt token context for host and host:port consistently", () => {
    const withoutPort = resolveTenant(new Headers({ host: "quizfactory.lan" }));
    const withPort = resolveTenant(new Headers({ host: "quizfactory.lan:3000" }));

    const token = issueAttemptToken(
      {
        tenant_id: withoutPort.tenantId,
        session_id: "session-1",
        distinct_id: "distinct-1"
      },
      60
    );
    const payload = verifyAttemptToken(token);

    expect(() =>
      assertAttemptTokenMatchesContext(payload, {
        tenant_id: withPort.tenantId,
        session_id: "session-1",
        distinct_id: "distinct-1"
      })
    ).not.toThrow();
  });
});

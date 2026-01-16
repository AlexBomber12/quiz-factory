import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertAttemptTokenMatchesContext,
  issueAttemptToken,
  verifyAttemptToken
} from "./attempt_token";

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
});

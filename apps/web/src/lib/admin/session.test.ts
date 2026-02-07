import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  issueAdminSession,
  resolveAdminRoleFromToken,
  verifyAdminSession
} from "./session";

const ENV_KEYS = ["ADMIN_TOKEN", "EDITOR_TOKEN", "ADMIN_SESSION_SECRET"] as const;

type EnvKey = (typeof ENV_KEYS)[number];

const setEnv = (key: EnvKey, value: string | undefined): void => {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) {
    delete env[key];
  } else {
    env[key] = value;
  }
};

describe("admin session", () => {
  let envSnapshot: Partial<Record<EnvKey, string | undefined>>;

  beforeEach(() => {
    envSnapshot = {};
    for (const key of ENV_KEYS) {
      envSnapshot[key] = process.env[key];
      setEnv(key, undefined);
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      setEnv(key, envSnapshot[key]);
    }
  });

  it("resolves admin token role", () => {
    setEnv("ADMIN_TOKEN", "admin-token");
    expect(resolveAdminRoleFromToken("admin-token")).toBe("admin");
  });

  it("resolves editor token role", () => {
    setEnv("EDITOR_TOKEN", "editor-token");
    expect(resolveAdminRoleFromToken("editor-token")).toBe("editor");
  });

  it("issues and verifies sessions", async () => {
    setEnv("ADMIN_SESSION_SECRET", "test-admin-session-secret");
    const issued = await issueAdminSession("admin", {
      now: new Date("2025-01-01T00:00:00.000Z"),
      ttlSeconds: 3600
    });

    const verified = await verifyAdminSession(issued.cookieValue, {
      now: new Date("2025-01-01T00:30:00.000Z")
    });

    expect(verified).toEqual({
      role: "admin",
      expires_at: "2025-01-01T01:00:00.000Z"
    });
  });

  it("rejects expired sessions", async () => {
    setEnv("ADMIN_SESSION_SECRET", "test-admin-session-secret");
    const issued = await issueAdminSession("editor", {
      now: new Date("2025-01-01T00:00:00.000Z"),
      ttlSeconds: 30
    });

    const verified = await verifyAdminSession(issued.cookieValue, {
      now: new Date("2025-01-01T00:01:00.000Z")
    });

    expect(verified).toBeNull();
  });

  it("rejects tampered sessions", async () => {
    setEnv("ADMIN_SESSION_SECRET", "test-admin-session-secret");
    const issued = await issueAdminSession("editor", {
      now: new Date("2025-01-01T00:00:00.000Z"),
      ttlSeconds: 60
    });
    const tampered = `${issued.cookieValue.slice(0, -1)}x`;

    const verified = await verifyAdminSession(tampered, {
      now: new Date("2025-01-01T00:00:30.000Z")
    });

    expect(verified).toBeNull();
  });
});

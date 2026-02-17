import { beforeEach, describe, expect, it, vi } from "vitest";

const csrfToken = "csrf-token-01234567890123456789";
let sessionRole: "admin" | "editor" | null = "admin";

const mocks = vi.hoisted(() => ({
  runAlertRules: vi.fn(),
  logAdminEvent: vi.fn()
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      if (name === "admin_csrf") {
        return { value: csrfToken };
      }

      if (name === "admin_session") {
        return { value: "session-cookie" };
      }

      return undefined;
    }
  })
}));

vi.mock("../../../../../../../lib/admin/session", () => ({
  ADMIN_SESSION_COOKIE: "admin_session",
  verifyAdminSession: vi.fn(async () => {
    if (!sessionRole) {
      return null;
    }

    return {
      role: sessionRole,
      expires_at: new Date(Date.now() + 60_000).toISOString()
    };
  })
}));

vi.mock("../../../../../../../lib/alerts/engine", () => ({
  runAlertRules: (...args: unknown[]) => mocks.runAlertRules(...args)
}));

vi.mock("../../../../../../../lib/admin/audit", () => ({
  logAdminEvent: (...args: unknown[]) => mocks.logAdminEvent(...args)
}));

import { POST } from "./route";

describe("POST /api/admin/alerts/rules/[rule_id]/run", () => {
  beforeEach(() => {
    sessionRole = "admin";
    mocks.runAlertRules.mockReset();
    mocks.logAdminEvent.mockReset();
    mocks.logAdminEvent.mockResolvedValue(undefined);
    mocks.runAlertRules.mockResolvedValue({
      rule_id: "rule-1",
      dry_run: true,
      evaluated: 1,
      triggered: 0,
      inserted: 0,
      results: []
    });
  });

  it("reads dry_run from JSON body when query param is absent", async () => {
    const response = await POST(
      new Request("https://tenant.example.com/api/admin/alerts/rules/rule-1/run", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-admin-csrf-token": csrfToken
        },
        body: JSON.stringify({
          csrf_token: csrfToken,
          dry_run: true
        })
      }),
      {
        params: { rule_id: "rule-1" }
      }
    );

    expect(response.status).toBe(200);
    expect(mocks.runAlertRules).toHaveBeenCalledWith({
      rule_id: "rule-1",
      dry_run: true
    });
  });

  it("reads dry_run from form body when query param is absent", async () => {
    const body = new URLSearchParams([
      ["csrf_token", csrfToken],
      ["dry_run", "true"]
    ]);

    const response = await POST(
      new Request("https://tenant.example.com/api/admin/alerts/rules/rule-1/run", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded",
          "x-admin-csrf-token": csrfToken
        },
        body
      }),
      {
        params: { rule_id: "rule-1" }
      }
    );

    expect(response.status).toBe(200);
    expect(mocks.runAlertRules).toHaveBeenCalledWith({
      rule_id: "rule-1",
      dry_run: true
    });
  });
});

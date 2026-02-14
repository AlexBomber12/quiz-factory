import { beforeEach, describe, expect, it, vi } from "vitest";

let sessionRole: "admin" | "editor" | null = "admin";
const csrfToken = "csrf-token-01234567890123456789";

const rollbackVersionForTenant = vi.fn();
const logAdminEvent = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => ({ value: csrfToken })
  })
}));

vi.mock("../../../../lib/admin/session", () => ({
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

vi.mock("../../../../lib/admin/publish", () => ({
  rollbackVersionForTenant: (...args: unknown[]) => rollbackVersionForTenant(...args),
  isPublishWorkflowError: (error: unknown) => {
    if (!error || typeof error !== "object") {
      return false;
    }

    const record = error as { code?: unknown; status?: unknown };
    return typeof record.code === "string" && typeof record.status === "number";
  }
}));

vi.mock("../../../../lib/admin/audit", () => ({
  logAdminEvent: (...args: unknown[]) => logAdminEvent(...args)
}));

import { POST } from "./route";

const buildJsonRequest = (body: Record<string, unknown>) => {
  return new Request("https://tenant.example.com/api/admin/rollback", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-admin-csrf-token": csrfToken
    },
    body: JSON.stringify(body)
  });
};

describe("POST /api/admin/rollback", () => {
  beforeEach(() => {
    sessionRole = "admin";
    rollbackVersionForTenant.mockReset();
    logAdminEvent.mockReset();
    rollbackVersionForTenant.mockResolvedValue({
      test_id: "test-focus-rhythm",
      version_id: "version-1",
      version: 1,
      tenant_ids: ["tenant-tenant-example-com"],
      is_enabled: true
    });
  });

  it("returns 401 when session is missing", async () => {
    sessionRole = null;

    const response = await POST(
      buildJsonRequest({
        test_id: "test-focus-rhythm",
        tenant_id: "tenant-tenant-example-com",
        version_id: "version-1"
      })
    );

    expect(response.status).toBe(401);
    const payload = await response.json();
    expect(payload.error).toBe("unauthorized");
  });

  it("returns 403 for editor role", async () => {
    sessionRole = "editor";

    const response = await POST(
      buildJsonRequest({
        test_id: "test-focus-rhythm",
        tenant_id: "tenant-tenant-example-com",
        version_id: "version-1"
      })
    );

    expect(response.status).toBe(403);
    const payload = await response.json();
    expect(payload.error).toBe("forbidden");
  });

  it("returns 403 when csrf token is missing", async () => {
    const response = await POST(
      new Request("https://tenant.example.com/api/admin/rollback", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          test_id: "test-focus-rhythm",
          tenant_id: "tenant-tenant-example-com",
          version_id: "version-1"
        })
      })
    );

    expect(response.status).toBe(403);
    const payload = await response.json();
    expect(payload.error).toBe("invalid_csrf");
  });

  it("rolls back when payload is valid", async () => {
    const response = await POST(
      buildJsonRequest({
        test_id: "test-focus-rhythm",
        tenant_id: "tenant-tenant-example-com",
        version_id: "version-1"
      })
    );

    expect(response.status).toBe(200);
    expect(rollbackVersionForTenant).toHaveBeenCalledWith({
      actor_role: "admin",
      test_id: "test-focus-rhythm",
      tenant_id: "tenant-tenant-example-com",
      version_id: "version-1"
    });
    expect(logAdminEvent).toHaveBeenCalledWith({
      actor: "admin",
      action: "test_rollback",
      entity_type: "test",
      entity_id: "test-focus-rhythm",
      metadata: {
        tenant_id: "tenant-tenant-example-com",
        version_id: "version-1",
        version: 1
      }
    });

    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.result.version_id).toBe("version-1");
  });

  it("returns structured workflow errors", async () => {
    rollbackVersionForTenant.mockRejectedValue({
      code: "test_version_not_found",
      status: 404,
      detail: "missing"
    });

    const response = await POST(
      buildJsonRequest({
        test_id: "test-focus-rhythm",
        tenant_id: "tenant-tenant-example-com",
        version_id: "missing"
      })
    );

    expect(response.status).toBe(404);
    const payload = await response.json();
    expect(payload.error).toBe("test_version_not_found");
    expect(payload.detail).toBe("missing");
  });

  it("redirects HTML form submissions back to /admin", async () => {
    const body = new URLSearchParams([
      ["csrf_token", csrfToken],
      ["test_id", "test-focus-rhythm"],
      ["tenant_id", "tenant-tenant-example-com"],
      ["version_id", "version-1"]
    ]);

    const response = await POST(
      new Request("https://tenant.example.com/api/admin/rollback", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded"
        },
        body
      })
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("/admin?rollback=ok");
  });
});

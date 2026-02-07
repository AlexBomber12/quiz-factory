import { beforeEach, describe, expect, it, vi } from "vitest";

let sessionRole: "admin" | "editor" | null = "admin";
const csrfToken = "csrf-token-01234567890123456789";

const publishVersionToTenants = vi.fn();

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
  publishVersionToTenants: (...args: unknown[]) => publishVersionToTenants(...args),
  isPublishWorkflowError: (error: unknown) => {
    if (!error || typeof error !== "object") {
      return false;
    }

    const record = error as { code?: unknown; status?: unknown };
    return typeof record.code === "string" && typeof record.status === "number";
  }
}));

import { POST } from "./route";

const buildJsonRequest = (body: Record<string, unknown>) => {
  return new Request("https://tenant.example.com/api/admin/publish", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-admin-csrf-token": csrfToken
    },
    body: JSON.stringify(body)
  });
};

describe("POST /api/admin/publish", () => {
  beforeEach(() => {
    sessionRole = "admin";
    publishVersionToTenants.mockReset();
    publishVersionToTenants.mockResolvedValue({
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
        version_id: "version-1",
        tenant_ids: ["tenant-tenant-example-com"],
        is_enabled: true
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
        version_id: "version-1",
        tenant_ids: ["tenant-tenant-example-com"],
        is_enabled: true
      })
    );

    expect(response.status).toBe(403);
    const payload = await response.json();
    expect(payload.error).toBe("forbidden");
  });

  it("returns 403 when csrf token is missing", async () => {
    const response = await POST(
      new Request("https://tenant.example.com/api/admin/publish", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          test_id: "test-focus-rhythm",
          version_id: "version-1",
          tenant_ids: ["tenant-tenant-example-com"],
          is_enabled: true
        })
      })
    );

    expect(response.status).toBe(403);
    const payload = await response.json();
    expect(payload.error).toBe("invalid_csrf");
  });

  it("publishes when payload is valid", async () => {
    const response = await POST(
      buildJsonRequest({
        test_id: "test-focus-rhythm",
        version_id: "version-1",
        tenant_ids: ["tenant-tenant-example-com"],
        is_enabled: true
      })
    );

    expect(response.status).toBe(200);
    expect(publishVersionToTenants).toHaveBeenCalledWith({
      actor_role: "admin",
      test_id: "test-focus-rhythm",
      version_id: "version-1",
      tenant_ids: ["tenant-tenant-example-com"],
      is_enabled: true
    });

    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.result.version_id).toBe("version-1");
  });

  it("returns structured workflow errors", async () => {
    publishVersionToTenants.mockRejectedValue({
      code: "unknown_tenant",
      status: 400,
      detail: "tenant-missing"
    });

    const response = await POST(
      buildJsonRequest({
        test_id: "test-focus-rhythm",
        version_id: "version-1",
        tenant_ids: ["tenant-missing"],
        is_enabled: true
      })
    );

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error).toBe("unknown_tenant");
    expect(payload.detail).toBe("tenant-missing");
  });

  it("redirects HTML form submissions back to /admin", async () => {
    const body = new URLSearchParams([
      ["csrf_token", csrfToken],
      ["test_id", "test-focus-rhythm"],
      ["version_id", "version-1"],
      ["tenant_ids", "tenant-tenant-example-com"],
      ["is_enabled", "true"]
    ]);

    const response = await POST(
      new Request("https://tenant.example.com/api/admin/publish", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded"
        },
        body
      })
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("/admin?publish=ok");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

let sessionRole: "admin" | "editor" | null = "admin";
const csrfToken = "csrf-token-01234567890123456789";

const publishVersionToTenants = vi.fn();
const logAdminEvent = vi.fn();
const validatePublishGuardrails = vi.fn();

const buildGuardrailError = (message: string): Error => {
  const error = new Error(message);
  error.name = "PublishGuardrailValidationError";
  return error;
};

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

vi.mock("../../../../lib/admin/publish_guardrails", () => ({
  isPublishGuardrailValidationError: (error: unknown) =>
    error instanceof Error && error.name === "PublishGuardrailValidationError",
  validatePublishGuardrails: (...args: unknown[]) => validatePublishGuardrails(...args)
}));

vi.mock("../../../../lib/admin/audit", () => ({
  logAdminEvent: (...args: unknown[]) => logAdminEvent(...args)
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
    logAdminEvent.mockReset();
    validatePublishGuardrails.mockReset();
    validatePublishGuardrails.mockResolvedValue(undefined);
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
    expect(validatePublishGuardrails).toHaveBeenCalledWith({
      test_id: "test-focus-rhythm",
      version_id: "version-1",
      tenant_ids: ["tenant-tenant-example-com"],
      is_enabled: true
    });
    expect(publishVersionToTenants).toHaveBeenCalledWith({
      actor_role: "admin",
      test_id: "test-focus-rhythm",
      version_id: "version-1",
      tenant_ids: ["tenant-tenant-example-com"],
      is_enabled: true
    });
    expect(logAdminEvent).toHaveBeenCalledWith({
      actor: "admin",
      action: "test_published",
      entity_type: "test",
      entity_id: "test-focus-rhythm",
      metadata: {
        version_id: "version-1",
        version: 1,
        tenant_ids: ["tenant-tenant-example-com"],
        is_enabled: true
      }
    });

    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.result.version_id).toBe("version-1");
  });

  it("passes disable requests through guardrails and publish mutation", async () => {
    const response = await POST(
      buildJsonRequest({
        test_id: "test-focus-rhythm",
        version_id: "version-1",
        tenant_ids: ["tenant-tenant-example-com"],
        is_enabled: false
      })
    );

    expect(response.status).toBe(200);
    expect(validatePublishGuardrails).toHaveBeenCalledWith({
      test_id: "test-focus-rhythm",
      version_id: "version-1",
      tenant_ids: ["tenant-tenant-example-com"],
      is_enabled: false
    });
    expect(publishVersionToTenants).toHaveBeenCalledWith({
      actor_role: "admin",
      test_id: "test-focus-rhythm",
      version_id: "version-1",
      tenant_ids: ["tenant-tenant-example-com"],
      is_enabled: false
    });
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

  it("returns 400 when guardrail checks fail", async () => {
    validatePublishGuardrails.mockRejectedValue(
      buildGuardrailError(
        "version_id 'version-1' does not belong to test_id 'test-focus-rhythm'."
      )
    );

    const response = await POST(
      buildJsonRequest({
        test_id: "test-focus-rhythm",
        version_id: "version-1",
        tenant_ids: ["tenant-tenant-example-com"],
        is_enabled: true
      })
    );

    expect(response.status).toBe(400);
    expect(publishVersionToTenants).not.toHaveBeenCalled();
    const payload = await response.json();
    expect(payload.error).toBe("invalid_payload");
    expect(payload.detail).toContain("does not belong to test_id");
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

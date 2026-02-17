import { beforeEach, describe, expect, it, vi } from "vitest";

let sessionRole: "admin" | "editor" | null = "admin";
const listAdminPublications = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => ({ value: "session-cookie" })
  })
}));

vi.mock("../../../../../lib/admin/session", () => ({
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

vi.mock("../../../../../lib/admin/publications", () => ({
  listAdminPublications: (...args: unknown[]) => listAdminPublications(...args)
}));

import { GET } from "./route";

describe("GET /api/admin/publications/export", () => {
  beforeEach(() => {
    sessionRole = "admin";
    listAdminPublications.mockReset();
    listAdminPublications.mockResolvedValue([
      {
        tenant_id: "tenant-tenant-example-com",
        domains: ["tenant.example.com"],
        content_type: "test",
        content_key: "test-focus-rhythm",
        slug: "focus-rhythm",
        published_version_id: "version-1",
        is_enabled: true,
        updated_at: "2026-01-01T10:00:00.000Z"
      }
    ]);
  });

  it("returns 401 when admin session is missing", async () => {
    sessionRole = null;

    const response = await GET(
      new Request("https://tenant.example.com/api/admin/publications/export")
    );

    expect(response.status).toBe(401);
    const payload = await response.json();
    expect(payload.error).toBe("unauthorized");
  });

  it("exports CSV and applies query filters", async () => {
    const response = await GET(
      new Request(
        "https://tenant.example.com/api/admin/publications/export?q=tenant.example.com&tenant_id=tenant-tenant-example-com&content_type=test&content_key=test-focus-rhythm&only_published=1&only_enabled=true"
      )
    );

    expect(response.status).toBe(200);
    expect(listAdminPublications).toHaveBeenCalledWith({
      q: "tenant.example.com",
      tenant_id: "tenant-tenant-example-com",
      content_type: "test",
      content_key: "test-focus-rhythm",
      test_id: null,
      only_published: true,
      only_enabled: true
    });
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain("admin-publications.csv");

    const text = await response.text();
    const lines = text.trimEnd().split("\n");
    expect(lines[0]).toBe(
      "tenant_id,domains,content_type,content_key,slug,published_version_id,is_enabled,updated_at"
    );
    expect(lines[1]).toContain("tenant-tenant-example-com");
    expect(lines[1]).toContain("tenant.example.com");
    expect(lines[1]).toContain("test-focus-rhythm");
  });

  it("allows editor sessions for export", async () => {
    sessionRole = "editor";

    const response = await GET(
      new Request("https://tenant.example.com/api/admin/publications/export")
    );

    expect(response.status).toBe(200);
    expect(listAdminPublications).toHaveBeenCalledTimes(1);
  });
});

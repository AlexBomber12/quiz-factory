import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  getContentDbPool: vi.fn()
}));

vi.mock("../content_db/pool", () => ({
  getContentDbPool: mocks.getContentDbPool
}));

import { listAdminPublications } from "./publications";

describe("listAdminPublications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getContentDbPool.mockReturnValue({
      query: mocks.query
    });
    mocks.query.mockResolvedValue({
      rows: [
        {
          tenant_id: "tenant-tenant-example-com",
          test_id: "test-focus-rhythm",
          slug: "focus-rhythm",
          published_version_id: "version-1",
          is_enabled: true,
          updated_at: new Date("2026-01-01T10:00:00.000Z")
        },
        {
          tenant_id: null,
          test_id: "test-energy-audit",
          slug: "energy-audit",
          published_version_id: null,
          is_enabled: null,
          updated_at: null
        }
      ]
    });
  });

  it("builds complete tenant x test rows and preserves publication state", async () => {
    const rows = await listAdminPublications();

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      tenant_id: "tenant-tenant-example-com",
      test_id: "test-energy-audit",
      slug: "energy-audit",
      published_version_id: null,
      is_enabled: false
    });
    expect(rows[1]).toMatchObject({
      tenant_id: "tenant-tenant-example-com",
      test_id: "test-focus-rhythm",
      slug: "focus-rhythm",
      published_version_id: "version-1",
      is_enabled: true
    });
  });

  it("supports only_published filter", async () => {
    const rows = await listAdminPublications({ only_published: true });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.test_id).toBe("test-focus-rhythm");
  });

  it("supports search across tenant domains", async () => {
    const rows = await listAdminPublications({ q: "tenant.example.com" });

    expect(rows).toHaveLength(2);
  });
});

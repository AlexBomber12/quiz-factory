import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  getContentDbPool: vi.fn(),
  listContentItems: vi.fn(),
  listDomainPublications: vi.fn()
}));

vi.mock("../content_db/pool", () => ({
  getContentDbPool: mocks.getContentDbPool
}));

vi.mock("../content_db/domain_publications", () => ({
  listContentItems: (...args: unknown[]) => mocks.listContentItems(...args),
  listDomainPublications: (...args: unknown[]) => mocks.listDomainPublications(...args)
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
          domain: "tenant.example.com"
        }
      ]
    });
    mocks.listContentItems.mockResolvedValue([
      {
        id: "content-1",
        content_type: "test",
        content_key: "test-energy-audit",
        slug: "energy-audit",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z"
      },
      {
        id: "content-2",
        content_type: "test",
        content_key: "test-focus-rhythm",
        slug: "focus-rhythm",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z"
      }
    ]);
    mocks.listDomainPublications.mockResolvedValue([
      {
        id: "publication-1",
        tenant_id: "tenant-tenant-example-com",
        content_type: "test",
        content_key: "test-focus-rhythm",
        slug: "focus-rhythm",
        published_version_id: "version-1",
        enabled: true,
        published_at: "2026-01-01T10:00:00.000Z",
        created_at: "2026-01-01T10:00:00.000Z",
        updated_at: "2026-01-01T10:00:00.000Z"
      }
    ]);
  });

  it("builds tenant x content matrix rows and preserves publication state", async () => {
    const rows = await listAdminPublications();

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      tenant_id: "tenant-tenant-example-com",
      content_type: "test",
      content_key: "test-energy-audit",
      slug: "energy-audit",
      published_version_id: null,
      is_enabled: false
    });
    expect(rows[1]).toMatchObject({
      tenant_id: "tenant-tenant-example-com",
      content_type: "test",
      content_key: "test-focus-rhythm",
      slug: "focus-rhythm",
      published_version_id: "version-1",
      is_enabled: true
    });
  });

  it("supports content_type filter", async () => {
    await listAdminPublications({ content_type: "test" });

    expect(mocks.listContentItems).toHaveBeenCalledWith({
      content_type: "test"
    });
    expect(mocks.listDomainPublications).toHaveBeenCalledWith(null, {
      content_type: "test",
      content_key: null
    });
  });

  it("supports only_published filter", async () => {
    const rows = await listAdminPublications({ only_published: true });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.content_key).toBe("test-focus-rhythm");
  });

  it("supports search across tenant domains", async () => {
    const rows = await listAdminPublications({ q: "tenant.example.com" });

    expect(rows).toHaveLength(2);
  });

  it("returns empty rows for unknown tenant filter", async () => {
    const rows = await listAdminPublications({ tenant_id: "tenant-missing" });

    expect(rows).toEqual([]);
    expect(mocks.listDomainPublications).toHaveBeenCalledWith("tenant-missing", {
      content_type: null,
      content_key: null
    });
  });
});

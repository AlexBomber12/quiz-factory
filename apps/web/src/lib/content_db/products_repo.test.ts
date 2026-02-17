import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  connect: vi.fn(),
  release: vi.fn(),
  clientQuery: vi.fn(),
  getContentDbPool: vi.fn(),
  publishDomainContent: vi.fn()
}));

vi.mock("./pool", () => ({
  getContentDbPool: mocks.getContentDbPool
}));

vi.mock("./domain_publications", () => ({
  publishDomainContent: (...args: unknown[]) => mocks.publishDomainContent(...args)
}));

import {
  createProduct,
  getPublishedProductBySlug,
  listTenantProducts,
  ProductRepoError,
  publishProductVersionToTenant
} from "./products_repo";

describe("products_repo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getContentDbPool.mockReturnValue({
      query: mocks.query,
      connect: mocks.connect
    });
  });

  it("rejects invalid product slug for createProduct", async () => {
    await expect(createProduct("Bad Slug")).rejects.toMatchObject({
      code: "invalid_slug"
    });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("maps published tenant products from domain publications", async () => {
    mocks.query.mockResolvedValue({
      rows: [
        {
          tenant_id: "tenant-a",
          product_id: "product-focus-kit",
          slug: "focus-kit",
          published_version_id: "a31d5c32-b458-4a9b-aac9-97de33e9ef33",
          published_version: 3,
          published_at: "2026-02-17T18:30:00.000Z",
          spec_json: {
            title: "Focus Kit"
          }
        }
      ]
    });

    const rows = await listTenantProducts("tenant-a");

    expect(rows).toEqual([
      {
        tenant_id: "tenant-a",
        product_id: "product-focus-kit",
        slug: "focus-kit",
        published_version_id: "a31d5c32-b458-4a9b-aac9-97de33e9ef33",
        published_version: 3,
        published_at: "2026-02-17T18:30:00.000Z",
        spec: {
          title: "Focus Kit"
        }
      }
    ]);
  });

  it("returns null when published product slug is missing", async () => {
    mocks.query.mockResolvedValue({ rows: [] });

    const row = await getPublishedProductBySlug("tenant-a", "focus-kit");

    expect(row).toBeNull();
  });

  it("surfaces product_exists on unique violations", async () => {
    mocks.query.mockRejectedValue({ code: "23505" });

    await expect(createProduct("focus-kit")).rejects.toMatchObject({
      code: "product_exists"
    });
  });

  it("publishes a product version via universal domain publications", async () => {
    mocks.clientQuery.mockResolvedValueOnce({});
    mocks.clientQuery.mockResolvedValueOnce({
      rows: [{ product_id: "product-focus-kit", slug: "focus-kit" }]
    });
    mocks.clientQuery.mockResolvedValueOnce({
      rows: [{ version_id: "a31d5c32-b458-4a9b-aac9-97de33e9ef33", version: 3 }]
    });
    mocks.clientQuery.mockResolvedValueOnce({});
    mocks.clientQuery.mockResolvedValueOnce({});
    mocks.clientQuery.mockResolvedValueOnce({});
    mocks.connect.mockResolvedValue({
      query: mocks.clientQuery,
      release: mocks.release
    });
    mocks.publishDomainContent.mockResolvedValue({
      enabled: true,
      published_at: "2026-02-17T19:00:00.000Z"
    });

    const result = await publishProductVersionToTenant({
      product_id: "product-focus-kit",
      version_id: "a31d5c32-b458-4a9b-aac9-97de33e9ef33",
      tenant_id: "tenant-a",
      is_enabled: true,
      published_at: new Date("2026-02-17T19:00:00.000Z")
    });

    expect(mocks.publishDomainContent).toHaveBeenCalledWith(
      "tenant-a",
      "product",
      "product-focus-kit",
      "a31d5c32-b458-4a9b-aac9-97de33e9ef33",
      true,
      expect.objectContaining({
        slug: "focus-kit"
      })
    );
    expect(result).toMatchObject({
      product_id: "product-focus-kit",
      slug: "focus-kit",
      tenant_id: "tenant-a",
      version_id: "a31d5c32-b458-4a9b-aac9-97de33e9ef33",
      version: 3,
      is_enabled: true,
      published_at: "2026-02-17T19:00:00.000Z"
    });
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });

  it("maps invalid tenant id input to a typed error on publish", async () => {
    await expect(
      publishProductVersionToTenant({
        product_id: "product-focus-kit",
        version_id: "a31d5c32-b458-4a9b-aac9-97de33e9ef33",
        tenant_id: "",
        is_enabled: true
      })
    ).rejects.toBeInstanceOf(ProductRepoError);
  });
});

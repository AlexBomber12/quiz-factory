import { beforeEach, describe, expect, it, vi } from "vitest";

let headerValues: Record<string, string> = {};
const listCatalogForTenantMock = vi.fn();
const resolveContentSourceMock = vi.fn();

vi.mock("next/headers", () => ({
  headers: () => new Headers(headerValues)
}));

vi.mock("../lib/content/provider", () => ({
  listCatalogForTenant: (...args: unknown[]) => listCatalogForTenantMock(...args),
  resolveContentSource: () => resolveContentSourceMock()
}));

import sitemap from "./sitemap";
import { invalidateTenant } from "../lib/seo/sitemap_cache";

const TENANT_ID = "tenant-tenant-example-com";

const setHeaders = (values: Record<string, string>) => {
  headerValues = values;
};

describe("sitemap db cache", () => {
  beforeEach(() => {
    setHeaders({
      host: "tenant.example.com",
      "x-forwarded-proto": "https"
    });

    listCatalogForTenantMock.mockReset();
    listCatalogForTenantMock.mockResolvedValue([
      {
        tenant_id: TENANT_ID,
        test_id: "test-focus-rhythm",
        slug: "focus-rhythm",
        default_locale: "en"
      }
    ]);

    resolveContentSourceMock.mockReset();
    resolveContentSourceMock.mockReturnValue("db");

    invalidateTenant(TENANT_ID);
  });

  it("caches sitemap lookups per tenant when CONTENT_SOURCE=db", async () => {
    await sitemap();
    await sitemap();

    expect(listCatalogForTenantMock).toHaveBeenCalledTimes(1);
    expect(listCatalogForTenantMock).toHaveBeenCalledWith(TENANT_ID);
  });

  it("rebuilds cached sitemap after tenant invalidation", async () => {
    await sitemap();
    invalidateTenant(TENANT_ID);
    await sitemap();

    expect(listCatalogForTenantMock).toHaveBeenCalledTimes(2);
  });

  it("keeps filesystem behavior uncached", async () => {
    resolveContentSourceMock.mockReturnValue("fs");

    await sitemap();
    await sitemap();

    expect(listCatalogForTenantMock).toHaveBeenCalledTimes(2);
  });
});

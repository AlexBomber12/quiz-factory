import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveTenantContext: vi.fn(),
  listTenantProducts: vi.fn()
}));

vi.mock("../../lib/tenants/request", () => ({
  resolveTenantContext: (...args: unknown[]) => mocks.resolveTenantContext(...args)
}));

vi.mock("../../lib/content/provider", () => ({
  listTenantProducts: (...args: unknown[]) => mocks.listTenantProducts(...args)
}));

import ProductsPage from "./page";

describe("/products page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveTenantContext.mockResolvedValue({
      tenantId: "tenant-a",
      locale: "en",
      host: "tenant.example.com",
      requestHost: "tenant.example.com",
      protocol: "https"
    });
  });

  it("renders empty state when no products are published", async () => {
    mocks.listTenantProducts.mockResolvedValue([]);

    const html = renderToStaticMarkup(await ProductsPage());

    expect(html).toContain("No products published yet");
    expect(html).toContain("Browse tests");
  });

  it("renders tenant product catalog when products are available", async () => {
    mocks.listTenantProducts.mockResolvedValue([
      {
        tenant_id: "tenant-a",
        product_id: "product-focus-kit",
        slug: "focus-kit",
        default_locale: "en",
        locale: "en",
        title: "Focus Kit",
        description: "A practical focus toolkit",
        price: "$19"
      }
    ]);

    const html = renderToStaticMarkup(await ProductsPage());

    expect(html).toContain("Focus Kit");
    expect(html).toContain("A practical focus toolkit");
    expect(html).toContain("/p/focus-kit");
  });
});

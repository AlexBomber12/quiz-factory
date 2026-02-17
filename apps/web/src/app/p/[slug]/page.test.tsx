import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveTenantContext: vi.fn(),
  loadPublishedProductBySlug: vi.fn()
}));

vi.mock("../../../lib/tenants/request", () => ({
  resolveTenantContext: (...args: unknown[]) => mocks.resolveTenantContext(...args)
}));

vi.mock("../../../lib/content/provider", () => ({
  loadPublishedProductBySlug: (...args: unknown[]) => mocks.loadPublishedProductBySlug(...args)
}));

import ProductDetailPage from "./page";

describe("/p/[slug] page", () => {
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

  it("renders unavailable state when product is missing for tenant", async () => {
    mocks.loadPublishedProductBySlug.mockResolvedValue(null);

    const html = renderToStaticMarkup(
      await ProductDetailPage({
        params: { slug: "focus-kit" }
      })
    );

    expect(html).toContain("Product not available");
    expect(html).toContain("Back to products");
  });

  it("renders published product detail", async () => {
    mocks.loadPublishedProductBySlug.mockResolvedValue({
      tenant_id: "tenant-a",
      product_id: "product-focus-kit",
      slug: "focus-kit",
      published_version_id: "a31d5c32-b458-4a9b-aac9-97de33e9ef33",
      published_version: 3,
      published_at: "2026-02-17T19:00:00.000Z",
      default_locale: "en",
      locale: "en",
      spec: {
        title: "Focus Kit"
      },
      product: {
        title: "Focus Kit",
        description: "A practical focus toolkit",
        price: "$19",
        images: ["https://cdn.example.com/focus-kit.jpg"],
        attributes: [{ key: "format", value: "PDF" }]
      }
    });

    const html = renderToStaticMarkup(
      await ProductDetailPage({
        params: { slug: "focus-kit" }
      })
    );

    expect(html).toContain("Focus Kit");
    expect(html).toContain("A practical focus toolkit");
    expect(html).toContain("format");
    expect(html).toContain("PDF");
  });
});

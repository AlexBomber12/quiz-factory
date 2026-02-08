import { beforeEach, describe, expect, it, vi } from "vitest";

let headerValues: Record<string, string> = {};
const listCatalogForTenantMock = vi.fn();
const loadPublishedTestBySlugMock = vi.fn();
const resolveContentSourceMock = vi.fn();

vi.mock("next/headers", () => ({
  headers: () => new Headers(headerValues)
}));

vi.mock("../lib/content/provider", () => ({
  listCatalogForTenant: (...args: unknown[]) => listCatalogForTenantMock(...args),
  loadPublishedTestBySlug: (...args: unknown[]) => loadPublishedTestBySlugMock(...args),
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

    loadPublishedTestBySlugMock.mockReset();
    loadPublishedTestBySlugMock.mockResolvedValue({
      tenant_id: TENANT_ID,
      test_id: "test-focus-rhythm",
      slug: "focus-rhythm",
      default_locale: "en",
      locale: "en",
      spec: {
        test_id: "test-focus-rhythm",
        slug: "focus-rhythm",
        version: 1,
        category: "daily habits",
        locales: {
          en: {
            title: "Focus Rhythm",
            short_description: "Stay focused",
            intro: "Intro",
            paywall_headline: "Unlock",
            report_title: "Focus Rhythm Report"
          }
        },
        questions: [],
        scoring: {
          scales: [],
          option_weights: {}
        },
        result_bands: []
      },
      test: {
        test_id: "test-focus-rhythm",
        slug: "focus-rhythm",
        category: "daily habits",
        title: "Focus Rhythm",
        description: "Stay focused",
        intro: "Intro",
        paywall_headline: "Unlock",
        report_title: "Focus Rhythm Report",
        questions: [],
        scoring: {
          scales: [],
          option_weights: {}
        },
        result_bands: [],
        locale: "en"
      }
    });

    resolveContentSourceMock.mockReset();
    resolveContentSourceMock.mockReturnValue("db");

    invalidateTenant(TENANT_ID);
    invalidateTenant("tenant-localhost");
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

  it("uses separate cache entries for different host/protocol contexts", async () => {
    setHeaders({
      host: "localhost:3000",
      "x-forwarded-proto": "http"
    });
    await sitemap();

    setHeaders({
      host: "localhost:4000",
      "x-forwarded-proto": "http"
    });
    await sitemap();

    expect(listCatalogForTenantMock).toHaveBeenCalledTimes(2);
    expect(listCatalogForTenantMock).toHaveBeenNthCalledWith(1, "tenant-localhost");
    expect(listCatalogForTenantMock).toHaveBeenNthCalledWith(2, "tenant-localhost");
  });

  it("keeps filesystem behavior uncached", async () => {
    resolveContentSourceMock.mockReturnValue("fs");

    await sitemap();
    await sitemap();

    expect(listCatalogForTenantMock).toHaveBeenCalledTimes(2);
  });
});

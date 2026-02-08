import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PublishedTenantTest, TenantCatalogRecord } from "../content/provider";

const listCatalogForTenantMock = vi.fn();
const loadPublishedTestBySlugMock = vi.fn();

vi.mock("../content/provider", () => ({
  listCatalogForTenant: (...args: unknown[]) => listCatalogForTenantMock(...args),
  loadPublishedTestBySlug: (...args: unknown[]) => loadPublishedTestBySlugMock(...args)
}));

import { deriveCategoriesFromCatalog } from "./categories";

const TENANT_ID = "tenant-tenant-example-com";
const TEST_ID = "test-focus-rhythm";
const SLUG = "focus-rhythm";

const catalogEntry: TenantCatalogRecord = {
  tenant_id: TENANT_ID,
  test_id: TEST_ID,
  slug: SLUG,
  default_locale: "en"
};

const buildPublished = (category: string): PublishedTenantTest => {
  return {
    tenant_id: TENANT_ID,
    test_id: TEST_ID,
    slug: SLUG,
    default_locale: "en",
    locale: "en",
    spec: {
      test_id: TEST_ID,
      slug: SLUG,
      version: 1,
      category,
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
        scales: ["focus"],
        option_weights: {}
      },
      result_bands: []
    },
    test: {
      test_id: TEST_ID,
      slug: SLUG,
      category,
      title: "Focus Rhythm",
      description: "Stay focused",
      intro: "Intro",
      paywall_headline: "Unlock",
      report_title: "Focus Rhythm Report",
      questions: [],
      scoring: {
        scales: ["focus"],
        option_weights: {}
      },
      result_bands: [],
      locale: "en"
    }
  };
};

describe("hub categories locale fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("falls back to catalog default locale when requested locale is missing", async () => {
    loadPublishedTestBySlugMock
      .mockRejectedValueOnce(new Error(`Missing locale es for test ${TEST_ID}`))
      .mockResolvedValueOnce(buildPublished("daily habits"));

    const categories = await deriveCategoriesFromCatalog(TENANT_ID, "es", [catalogEntry]);

    expect(categories).toEqual([
      {
        slug: "daily-habits",
        label: "daily habits",
        test_count: 1
      }
    ]);
    expect(loadPublishedTestBySlugMock).toHaveBeenNthCalledWith(1, TENANT_ID, SLUG, "es");
    expect(loadPublishedTestBySlugMock).toHaveBeenNthCalledWith(2, TENANT_ID, SLUG, "en");
  });

  it("skips tests when both requested and default locales are unavailable", async () => {
    loadPublishedTestBySlugMock
      .mockRejectedValueOnce(new Error(`Missing locale es for test ${TEST_ID}`))
      .mockRejectedValueOnce(new Error(`Missing locale en for test ${TEST_ID}`));

    const categories = await deriveCategoriesFromCatalog(TENANT_ID, "es", [catalogEntry]);

    expect(categories).toEqual([]);
  });

  it("rethrows non-locale errors", async () => {
    loadPublishedTestBySlugMock.mockRejectedValueOnce(new Error("database offline"));

    await expect(
      deriveCategoriesFromCatalog(TENANT_ID, "es", [catalogEntry])
    ).rejects.toThrow("database offline");
  });
});

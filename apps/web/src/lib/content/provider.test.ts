import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LocalizedTest, TestSpec } from "./types";

const mocks = vi.hoisted(() => ({
  getTenantCatalog: vi.fn(),
  getPublishedTestBySlug: vi.fn(),
  getTenantTestIds: vi.fn(),
  resolveTestIdBySlug: vi.fn(),
  loadTestSpecById: vi.fn(),
  loadValuesCompassSpecById: vi.fn(),
  localizeTestSpec: vi.fn()
}));

vi.mock("../content_db/repo", () => ({
  getTenantCatalog: mocks.getTenantCatalog,
  getPublishedTestBySlug: mocks.getPublishedTestBySlug
}));

vi.mock("./catalog", () => ({
  getTenantTestIds: mocks.getTenantTestIds,
  resolveTestIdBySlug: mocks.resolveTestIdBySlug
}));

vi.mock("./load", () => ({
  loadTestSpecById: mocks.loadTestSpecById,
  loadValuesCompassSpecById: mocks.loadValuesCompassSpecById,
  localizeTestSpec: mocks.localizeTestSpec
}));

import {
  listCatalogForTenant,
  loadPublishedTestBySlug
} from "./provider";

const ORIGINAL_CONTENT_SOURCE = process.env.CONTENT_SOURCE;

const TEST_SPEC: TestSpec = {
  test_id: "test-focus-rhythm",
  slug: "focus-rhythm",
  version: 1,
  category: "productivity",
  locales: {
    en: {
      title: "Focus Rhythm",
      short_description: "Find your focus rhythm.",
      intro: "Intro",
      paywall_headline: "Unlock report",
      report_title: "Your focus report"
    }
  },
  questions: [
    {
      id: "q1",
      type: "single_choice",
      prompt: { en: "Question?" },
      options: [
        {
          id: "o1",
          label: { en: "Option" }
        }
      ]
    }
  ],
  scoring: {
    scales: ["focus"],
    option_weights: {
      o1: { focus: 1 }
    }
  },
  result_bands: [
    {
      band_id: "balanced",
      min_score_inclusive: 0,
      max_score_inclusive: 1,
      copy: {
        en: {
          headline: "Balanced",
          summary: "Summary",
          bullets: ["Bullet"]
        }
      }
    }
  ]
};

const LOCALIZED_TEST: LocalizedTest = {
  test_id: TEST_SPEC.test_id,
  slug: TEST_SPEC.slug,
  category: TEST_SPEC.category,
  title: "Focus Rhythm",
  description: "Find your focus rhythm.",
  intro: "Intro",
  paywall_headline: "Unlock report",
  report_title: "Your focus report",
  questions: [
    {
      id: "q1",
      type: "single_choice",
      prompt: "Question?",
      options: [
        {
          id: "o1",
          label: "Option"
        }
      ]
    }
  ],
  scoring: TEST_SPEC.scoring,
  result_bands: TEST_SPEC.result_bands,
  locale: "en"
};

describe("content provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CONTENT_SOURCE;
  });

  afterEach(() => {
    if (ORIGINAL_CONTENT_SOURCE === undefined) {
      delete process.env.CONTENT_SOURCE;
    } else {
      process.env.CONTENT_SOURCE = ORIGINAL_CONTENT_SOURCE;
    }
  });

  it("uses filesystem catalog loader by default", async () => {
    mocks.getTenantTestIds.mockReturnValue(["test-focus-rhythm"]);
    mocks.loadValuesCompassSpecById.mockReturnValue(TEST_SPEC);

    const catalog = await listCatalogForTenant("tenant-a");

    expect(mocks.getTenantCatalog).not.toHaveBeenCalled();
    expect(catalog).toEqual([
      {
        tenant_id: "tenant-a",
        test_id: "test-focus-rhythm",
        slug: "focus-rhythm",
        default_locale: "en"
      }
    ]);
  });

  it("uses database catalog loader when CONTENT_SOURCE=db", async () => {
    process.env.CONTENT_SOURCE = "db";
    mocks.getTenantCatalog.mockResolvedValue([
      {
        tenant_id: "tenant-a",
        test_id: "test-focus-rhythm",
        slug: "focus-rhythm",
        default_locale: "en"
      }
    ]);

    const catalog = await listCatalogForTenant("tenant-a");

    expect(mocks.getTenantCatalog).toHaveBeenCalledWith("tenant-a");
    expect(mocks.getTenantTestIds).not.toHaveBeenCalled();
    expect(catalog).toHaveLength(1);
  });

  it("loads published tests from filesystem by default", async () => {
    mocks.resolveTestIdBySlug.mockReturnValue("test-focus-rhythm");
    mocks.getTenantTestIds.mockReturnValue(["test-focus-rhythm"]);
    mocks.loadTestSpecById.mockReturnValue(TEST_SPEC);
    mocks.localizeTestSpec.mockReturnValue(LOCALIZED_TEST);

    const published = await loadPublishedTestBySlug("tenant-a", "focus-rhythm", "en");

    expect(mocks.getPublishedTestBySlug).not.toHaveBeenCalled();
    expect(published?.test_id).toBe("test-focus-rhythm");
    expect(published?.slug).toBe("focus-rhythm");
    expect(published?.test.title).toBe("Focus Rhythm");
  });

  it("loads published tests from database when CONTENT_SOURCE=db", async () => {
    process.env.CONTENT_SOURCE = "db";
    mocks.getPublishedTestBySlug.mockResolvedValue({
      tenant_id: "tenant-a",
      test_id: "test-focus-rhythm",
      slug: "focus-rhythm",
      default_locale: "en",
      published_version_id: "version-id",
      published_version: 1,
      published_at: null,
      locale: "en",
      spec: TEST_SPEC
    });
    mocks.localizeTestSpec.mockReturnValue(LOCALIZED_TEST);

    const published = await loadPublishedTestBySlug("tenant-a", "focus-rhythm", "en");

    expect(mocks.getPublishedTestBySlug).toHaveBeenCalledWith(
      "tenant-a",
      "focus-rhythm",
      "en"
    );
    expect(published?.test.report_title).toBe("Your focus report");
  });
});


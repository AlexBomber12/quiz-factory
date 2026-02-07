import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PublishedTenantTest, TenantCatalogRecord } from "../content/provider";
import type { TestSpec } from "../content/types";
import { listCatalogForTenant, loadPublishedTestBySlug } from "../content/provider";
import { loadTenantCatalog, resolveTenantTestBySlug } from "./catalog";

vi.mock("../content/provider", () => ({
  listCatalogForTenant: vi.fn(),
  loadPublishedTestBySlug: vi.fn()
}));

const TENANT_ID = "tenant-tenant-example-com";
const TEST_ID = "test-focus-rhythm";
const SLUG = "focus-rhythm";

const baseCatalogEntry: TenantCatalogRecord = {
  tenant_id: TENANT_ID,
  test_id: TEST_ID,
  slug: SLUG,
  default_locale: "en"
};

const buildSpec = (input: { questionCount: number; estimatedMinutes?: number }): TestSpec => {
  const questions = Array.from({ length: input.questionCount }, (_unused, index) => {
    const optionId = `q${index + 1}-opt-1`;
    return {
      id: `q${index + 1}`,
      type: "single_choice" as const,
      prompt: {
        en: `Question ${index + 1}`
      },
      options: [
        {
          id: optionId,
          label: {
            en: "Agree"
          }
        }
      ]
    };
  });

  const optionWeights = Object.fromEntries(
    questions.flatMap((question) =>
      question.options.map((option) => [option.id, { focus: 1 }])
    )
  );

  return {
    test_id: TEST_ID,
    slug: SLUG,
    version: 1,
    category: "focus",
    ...(input.estimatedMinutes === undefined
      ? {}
      : { estimated_minutes: input.estimatedMinutes }),
    locales: {
      en: {
        title: "Focus Rhythm",
        short_description: "Stay focused",
        intro: "Intro",
        paywall_headline: "Unlock",
        report_title: "Focus Rhythm Report"
      }
    },
    questions,
    scoring: {
      scales: ["focus"],
      option_weights: optionWeights
    },
    result_bands: [
      {
        band_id: "balanced",
        min_score_inclusive: 1,
        max_score_inclusive: 99,
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
};

const buildPublished = (spec: TestSpec): PublishedTenantTest => {
  return {
    tenant_id: TENANT_ID,
    test_id: spec.test_id,
    slug: spec.slug,
    default_locale: "en",
    locale: "en",
    spec,
    test: {
      test_id: spec.test_id,
      slug: spec.slug,
      category: spec.category,
      title: "Focus Rhythm",
      description: "Stay focused",
      intro: "Intro",
      paywall_headline: "Unlock",
      report_title: "Focus Rhythm Report",
      questions: [],
      scoring: spec.scoring,
      result_bands: spec.result_bands,
      locale: "en"
    }
  };
};

describe("catalog loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listCatalogForTenant).mockResolvedValue([baseCatalogEntry]);
  });

  it("uses spec estimated_minutes when present", async () => {
    vi.mocked(loadPublishedTestBySlug).mockResolvedValue(
      buildPublished(buildSpec({ questionCount: 5, estimatedMinutes: 13 }))
    );

    const tests = await loadTenantCatalog(TENANT_ID, "en");

    expect(tests).toHaveLength(1);
    expect(tests[0]?.estimated_minutes).toBe(13);
  });

  it("falls back when estimated_minutes is missing (regression: no test_index entry)", async () => {
    vi.mocked(loadPublishedTestBySlug).mockResolvedValue(
      buildPublished(buildSpec({ questionCount: 7 }))
    );

    const tests = await loadTenantCatalog(TENANT_ID, "en");

    expect(tests).toHaveLength(1);
    expect(tests[0]?.estimated_minutes).toBe(4);
  });

  it("resolves a tenant test by slug", async () => {
    vi.mocked(loadPublishedTestBySlug).mockResolvedValue(
      buildPublished(buildSpec({ questionCount: 4, estimatedMinutes: 12 }))
    );

    const test = await resolveTenantTestBySlug(TENANT_ID, "en", SLUG);

    expect(test).not.toBeNull();
    expect(test?.slug).toBe(SLUG);
  });
});

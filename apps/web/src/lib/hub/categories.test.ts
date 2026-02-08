import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadPublishedTestBySlug } from "../content/provider";
import { deriveTenantCategories, toCategorySlug } from "./categories";

const TENANT_ID = "tenant-tenant-example-com";
const GOLDEN_SLUG = "focus-rhythm";
const LOCALE = "en";

describe("hub categories", () => {
  const originalContentSource = process.env.CONTENT_SOURCE;

  beforeAll(() => {
    process.env.CONTENT_SOURCE = "fs";
  });

  afterAll(() => {
    if (originalContentSource === undefined) {
      delete process.env.CONTENT_SOURCE;
      return;
    }

    process.env.CONTENT_SOURCE = originalContentSource;
  });

  it("produces stable slugs for representative category labels", () => {
    const representativeCases = [
      {
        input: "Daily Habits",
        expected: "daily-habits"
      },
      {
        input: "daily_habits",
        expected: "daily-habits"
      },
      {
        input: "  Mind & Body  ",
        expected: "mind-body"
      },
      {
        input: "Energy___Flow",
        expected: "energy-flow"
      },
      {
        input: "100% Growth",
        expected: "100-growth"
      }
    ];

    for (const testCase of representativeCases) {
      expect(toCategorySlug(testCase.input)).toBe(testCase.expected);
      expect(toCategorySlug(testCase.input)).toBe(testCase.expected);
    }
  });

  it("derives at least one category for the golden test tenant when category metadata exists", async () => {
    const published = await loadPublishedTestBySlug(TENANT_ID, GOLDEN_SLUG, LOCALE);
    expect(published).not.toBeNull();

    const expectedSlug = toCategorySlug(published?.test.category ?? "");
    expect(expectedSlug.length).toBeGreaterThan(0);

    const categories = await deriveTenantCategories(TENANT_ID, LOCALE);
    expect(categories.length).toBeGreaterThanOrEqual(1);
    expect(categories.map((category) => category.slug)).toContain(expectedSlug);
  });
});

import { describe, expect, it } from "vitest";

import { resolveCategoryLabel, toHumanCategoryLabel } from "./category_label";

describe("category_label", () => {
  it("formats slug-like labels into human-readable copy", () => {
    expect(toHumanCategoryLabel("daily-habits")).toBe("Daily habits");
    expect(toHumanCategoryLabel("stress_management")).toBe("Stress management");
  });

  it("preserves non-slug labels", () => {
    expect(toHumanCategoryLabel("Career Growth")).toBe("Career Growth");
  });

  it("falls back to slug and then default label", () => {
    expect(resolveCategoryLabel("", "focus-rhythm")).toBe("Focus rhythm");
    expect(resolveCategoryLabel("", "")).toBe("General");
  });
});

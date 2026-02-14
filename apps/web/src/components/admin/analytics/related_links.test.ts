import { describe, expect, it } from "vitest";

import { mergeHrefWithSearchParams } from "./related_links";

describe("mergeHrefWithSearchParams", () => {
  it("adds current filters to a link without querystring", () => {
    const current = new URLSearchParams({
      start: "2026-02-08",
      end: "2026-02-14",
      tenant_id: "tenant-quizfactory-en"
    });

    expect(mergeHrefWithSearchParams("/admin/analytics/tests", current)).toBe(
      "/admin/analytics/tests?start=2026-02-08&end=2026-02-14&tenant_id=tenant-quizfactory-en"
    );
  });

  it("keeps link-specific params and appends missing current filters", () => {
    const current = new URLSearchParams({
      start: "2026-02-08",
      end: "2026-02-14",
      tenant_id: "tenant-quizfactory-en",
      test_id: "test-energy-balance"
    });

    expect(mergeHrefWithSearchParams("/admin/analytics/revenue?test_id=test-focus-rhythm", current)).toBe(
      "/admin/analytics/revenue?test_id=test-focus-rhythm&start=2026-02-08&end=2026-02-14&tenant_id=tenant-quizfactory-en"
    );
  });
});

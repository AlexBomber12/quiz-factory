import { describe, expect, it } from "vitest";

import {
  resolveHomePageContentPack,
  resolveTestsPageContentPack
} from "./content_pack";

describe("content_pack", () => {
  it("provides safe homepage fallback copy for unknown tenants", () => {
    const pack = resolveHomePageContentPack("tenant-unknown");

    expect(pack.heroHeadline).toBe("Discover your next self-assessment");
    expect(pack.heroSubheadline).toBe("Browse the available tests and start when ready.");
    expect(pack.explorer.sectionHeading).toBe("Featured Assessments");
  });

  it("returns stable tests page marketing copy", () => {
    const pack = resolveTestsPageContentPack();

    expect(pack.heroHeadline).toBe("Tests");
    expect(pack.sectionHeadings.browse).toBe("Browse Assessments");
    expect(pack.sectionHeadings.howItWorks).toBe("How it works");
    expect(pack.explorer.sectionHeading).toBe("Browse Assessments");
  });
});

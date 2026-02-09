import { describe, expect, it } from "vitest";

import type { TestSpec } from "../content/types";
import {
  resolveRouteParams,
  resolveTestMetadataCopy,
  safeLowercaseSlug,
  safeTrim
} from "./metadata_safety";

const makeSpec = (): TestSpec => {
  return {
    test_id: "test-focus-rhythm",
    slug: "focus-rhythm",
    version: 1,
    category: "productivity",
    locales: {
      en: {
        title: "Focus Rhythm",
        short_description: "Understand your focus pattern.",
        intro: "Answer a few questions.",
        paywall_headline: "Unlock your full report",
        report_title: "Focus Rhythm Report"
      },
      es: {
        title: "Ritmo de Enfoque",
        short_description: "Comprende tu patron de enfoque.",
        intro: "Responde algunas preguntas.",
        paywall_headline: "Desbloquea tu reporte completo",
        report_title: "Reporte de Ritmo de Enfoque"
      }
    },
    questions: [],
    scoring: {
      scales: [],
      option_weights: {}
    },
    result_bands: []
  };
};

describe("metadata safety helpers", () => {
  it("safeTrim returns fallback for missing or whitespace values", () => {
    expect(safeTrim(undefined, "fallback")).toBe("fallback");
    expect(safeTrim("   ", "fallback")).toBe("fallback");
    expect(safeTrim(" value ", "fallback")).toBe("value");
  });

  it("resolves params from both direct objects and promises", async () => {
    await expect(resolveRouteParams({ slug: "focus-rhythm" })).resolves.toEqual({
      slug: "focus-rhythm"
    });
    await expect(resolveRouteParams(Promise.resolve({ slug: "focus-rhythm" }))).resolves.toEqual({
      slug: "focus-rhythm"
    });
  });

  it("builds metadata copy without throwing when fields are missing", () => {
    const copy = resolveTestMetadataCopy({
      routeSlug: " focus-rhythm ",
      title: undefined,
      descriptionCandidates: [undefined, "   "],
      fallbackDescription: "This test is available."
    });

    expect(copy.slug).toBe("focus-rhythm");
    expect(copy.title).toBe("focus-rhythm");
    expect(copy.description).toBe("This test is available.");
  });

  it("falls back to spec locale strings when metadata values are missing", () => {
    const copy = resolveTestMetadataCopy({
      routeSlug: "focus-rhythm",
      spec: makeSpec(),
      locale: "es",
      fallbackDescription: "fallback-description"
    });

    expect(copy.title).toBe("Ritmo de Enfoque");
    expect(copy.description).toBe("Comprende tu patron de enfoque.");
  });

  it("normalizes slug values safely", () => {
    expect(safeLowercaseSlug(undefined, "Fallback-Slug")).toBe("fallback-slug");
    expect(safeLowercaseSlug("  Focus-Rhythm  ", "fallback")).toBe("focus-rhythm");
  });
});

import { describe, expect, it } from "vitest";

import {
  buildImportPreview,
  buildImportWarnings,
  buildMarkdownExcerpt,
  guessMarkdownTitle,
  hashMarkdown,
  normalizeImportLocale,
  parseImportLocaleFromFilename
} from "./imports";

describe("admin import helpers", () => {
  it("parses locale from source.<locale>.md filenames", () => {
    expect(parseImportLocaleFromFilename("source.en.md")).toBe("en");
    expect(parseImportLocaleFromFilename("source.pt-br.md")).toBe("pt-BR");
    expect(parseImportLocaleFromFilename("source.fr.md")).toBe("fr");
    expect(parseImportLocaleFromFilename("source.de.md")).toBe("de");
    expect(parseImportLocaleFromFilename("source.en.txt")).toBeNull();
    expect(parseImportLocaleFromFilename("notes.en.md")).toBeNull();
  });

  it("normalizes locale tags with region casing", () => {
    expect(normalizeImportLocale("pt-br")).toBe("pt-BR");
    expect(normalizeImportLocale("zh-hant")).toBe("zh-Hant");
    expect(normalizeImportLocale("en-US")).toBe("en-US");
    expect(normalizeImportLocale("")).toBeNull();
    expect(normalizeImportLocale("$$$")).toBeNull();
  });

  it("extracts markdown title with h1 fallback to first non-empty line", () => {
    expect(guessMarkdownTitle("\n\n# Title Here\n\nBody")).toBe("Title Here");
    expect(guessMarkdownTitle("\n\nIntro line\n\n# Later")).toBe("Later");
    expect(guessMarkdownTitle("\n\nIntro line\n\nMore text")).toBe("Intro line");
    expect(guessMarkdownTitle("   \n  ")).toBe("(empty markdown)");
  });

  it("builds excerpt as escaped plain text source slice", () => {
    const excerpt = buildMarkdownExcerpt("  \nfirst\nsecond\nthird\nfourth", 12);
    expect(excerpt).toBe("first\nsecon...");
    expect(buildMarkdownExcerpt("   \n \n")).toBe("(empty markdown)");
  });

  it("builds warnings for missing required locales and duplicate hashes", () => {
    const duplicateHash = hashMarkdown("# Same");
    const warnings = buildImportWarnings({
      en: { filename: "source.en.md", md: "# Same", sha256: duplicateHash },
      es: { filename: "source.es.md", md: "# Same", sha256: duplicateHash },
      fr: { filename: "source.fr.md", md: "# Different", sha256: hashMarkdown("# Different") }
    });

    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain("Missing required locales: pt-BR");
    expect(warnings[1]).toContain("Duplicate markdown hash");
    expect(warnings[1]).toContain("en, es");
  });

  it("builds preview rows with computed metadata", () => {
    const preview = buildImportPreview({
      en: {
        filename: "source.en.md",
        md: "# English title\n\nLine",
        sha256: hashMarkdown("# English title\n\nLine")
      }
    });

    expect(preview.files).toHaveLength(1);
    expect(preview.files[0]?.locale).toBe("en");
    expect(preview.files[0]?.title_guess).toBe("English title");
    expect(preview.files[0]?.size_bytes).toBeGreaterThan(0);
    expect(preview.warnings[0]).toContain("Missing required locales");
  });
});

import { describe, expect, it } from "vitest";

import {
  ImportConversionError,
  buildImportPreview,
  buildImportWarnings,
  buildMarkdownExcerpt,
  computeCanonicalJsonSha256,
  guessMarkdownTitle,
  hashMarkdown,
  isImportLocaleAllowed,
  normalizeImportLocale,
  normalizeUniversalSpecForValidation,
  parseImportLocaleFromFilename,
  resolveConversionMetadata
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

  it("enforces import locale allowlist regex with safe defaults", () => {
    const previous = process.env.ADMIN_IMPORT_LOCALE_ALLOWLIST_REGEX;

    delete process.env.ADMIN_IMPORT_LOCALE_ALLOWLIST_REGEX;
    expect(isImportLocaleAllowed("en")).toBe(true);
    expect(isImportLocaleAllowed("fr")).toBe(false);

    process.env.ADMIN_IMPORT_LOCALE_ALLOWLIST_REGEX = "^(en|fr)$";
    expect(isImportLocaleAllowed("fr")).toBe(true);
    expect(isImportLocaleAllowed("pt-BR")).toBe(false);

    process.env.ADMIN_IMPORT_LOCALE_ALLOWLIST_REGEX = "[";
    expect(isImportLocaleAllowed("en")).toBe(true);
    expect(isImportLocaleAllowed("fr")).toBe(false);

    if (previous === undefined) {
      delete process.env.ADMIN_IMPORT_LOCALE_ALLOWLIST_REGEX;
    } else {
      process.env.ADMIN_IMPORT_LOCALE_ALLOWLIST_REGEX = previous;
    }
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

  it("resolves conversion metadata from universal front matter and derives slug when needed", () => {
    const markdown = [
      "---",
      "format_id: universal_human_v1",
      "version: 1",
      "---",
      "# Focus Sprint",
      "Intro"
    ].join("\n");

    const metadata = resolveConversionMetadata({
      en: {
        filename: "source.en.md",
        md: markdown,
        sha256: hashMarkdown(markdown)
      }
    });

    expect(metadata.format_id).toBe("universal_human_v1");
    expect(metadata.slug).toBe("focus-sprint");
    expect(metadata.test_id).toBe("test-focus-sprint");
    expect(metadata.estimated_minutes).toBeUndefined();
  });

  it("preserves provided test_id and derives missing slug from it", () => {
    const markdown = [
      "---",
      "format_id: universal_human_v1",
      "test_id: test-explicit-id",
      "---",
      "# Different Title",
      "Intro"
    ].join("\n");

    const metadata = resolveConversionMetadata({
      en: {
        filename: "source.en.md",
        md: markdown,
        sha256: hashMarkdown(markdown)
      }
    });

    expect(metadata.test_id).toBe("test-explicit-id");
    expect(metadata.slug).toBe("explicit-id");
  });

  it("preserves provided slug and derives missing test_id from it", () => {
    const markdown = [
      "---",
      "format_id: universal_human_v1",
      "slug: explicit-slug",
      "---",
      "# Different Title",
      "Intro"
    ].join("\n");

    const metadata = resolveConversionMetadata({
      en: {
        filename: "source.en.md",
        md: markdown,
        sha256: hashMarkdown(markdown)
      }
    });

    expect(metadata.slug).toBe("explicit-slug");
    expect(metadata.test_id).toBe("test-explicit-slug");
  });

  it("reads estimated_minutes from front matter metadata", () => {
    const markdown = [
      "---",
      "format_id: universal_human_v1",
      "test_id: test-explicit-id",
      "estimated_minutes: 15",
      "---",
      "# Different Title",
      "Intro"
    ].join("\n");

    const metadata = resolveConversionMetadata({
      en: {
        filename: "source.en.md",
        md: markdown,
        sha256: hashMarkdown(markdown)
      }
    });

    expect(metadata.estimated_minutes).toBe(15);
  });

  it("fails when front matter estimated_minutes is outside supported range", () => {
    const markdown = [
      "---",
      "format_id: universal_human_v1",
      "test_id: test-explicit-id",
      "estimated_minutes: 0",
      "---",
      "# Different Title",
      "Intro"
    ].join("\n");

    expect(() =>
      resolveConversionMetadata({
        en: {
          filename: "source.en.md",
          md: markdown,
          sha256: hashMarkdown(markdown)
        }
      })
    ).toThrowError(ImportConversionError);
  });

  it("returns unsupported_format when source.en.md lacks universal format_id", () => {
    const markdown = [
      "---",
      "test_id: test-focus-sprint",
      "slug: focus-sprint",
      "---",
      "# Focus Sprint"
    ].join("\n");

    expect(() =>
      resolveConversionMetadata({
        en: {
          filename: "source.en.md",
          md: markdown,
          sha256: hashMarkdown(markdown)
        }
      })
    ).toThrowError(ImportConversionError);

    try {
      resolveConversionMetadata({
        en: {
          filename: "source.en.md",
          md: markdown,
          sha256: hashMarkdown(markdown)
        }
      });
      throw new Error("Expected unsupported_format error");
    } catch (error) {
      expect(error).toBeInstanceOf(ImportConversionError);
      const typed = error as ImportConversionError;
      expect(typed.code).toBe("unsupported_format");
      expect(typed.preserve_import_status).toBe(true);
    }
  });

  it("normalizes universal converted spec into validateTestSpec-compatible JSON", () => {
    const normalized = normalizeUniversalSpecForValidation(
      {
        test_id: "test-focus-sprint",
        slug: "focus-sprint",
        version: 1,
        category: "focus",
        locales: {
          en: {
            title: "Focus Sprint",
            short_description: "EN short",
            intro: "EN intro",
            paywall_hook: "EN paywall",
            paid_report_structure: "EN report"
          },
          es: {
            title: "Focus Sprint",
            short_description: "ES short",
            intro: "ES intro",
            paywall_hook: "ES paywall",
            paid_report_structure: "ES report"
          },
          "pt-BR": {
            title: "Focus Sprint",
            short_description: "PT short",
            intro: "PT intro",
            paywall_hook: "PT paywall",
            paid_report_structure: "PT report"
          }
        },
        scales: ["focus"],
        questions: [
          {
            question_id: "q01",
            scale_id: "focus",
            prompt: {
              en: "I stay focused.",
              es: "Mantengo foco.",
              "pt-BR": "Mantenho foco."
            }
          }
        ]
      },
      {
        format_id: "universal_human_v1",
        test_id: "test-focus-sprint",
        slug: "focus-sprint",
        en_title: "Focus Sprint"
      }
    ) as {
      test_id: string;
      estimated_minutes: number;
      questions: Array<{ id: string; options: Array<{ id: string }> }>;
      scoring: { option_weights: Record<string, Record<string, number>> };
      result_bands: Array<{ band_id: string }>;
    };

    expect(normalized.test_id).toBe("test-focus-sprint");
    expect(normalized.questions).toHaveLength(1);
    expect(normalized.questions[0]?.options).toHaveLength(5);
    expect(normalized.estimated_minutes).toBe(2);
    expect(normalized.scoring.option_weights["q01-opt-1"]?.focus).toBe(1);
    expect(normalized.scoring.option_weights["q01-opt-5"]?.focus).toBe(5);
    expect(normalized.result_bands.map((band) => band.band_id)).toEqual([
      "low",
      "mid",
      "high"
    ]);
  });

  it("computes stable checksum for semantically equal JSON with different key order", () => {
    const left = {
      b: 1,
      a: {
        y: 2,
        x: [
          {
            m: "z",
            a: "b"
          }
        ]
      }
    };

    const right = {
      a: {
        x: [
          {
            a: "b",
            m: "z"
          }
        ],
        y: 2
      },
      b: 1
    };

    const leftHash = computeCanonicalJsonSha256(left).checksum;
    const rightHash = computeCanonicalJsonSha256(right).checksum;

    expect(leftHash).toBe(rightHash);
  });
});

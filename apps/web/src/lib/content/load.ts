import fs from "node:fs";
import path from "node:path";

import {
  LocaleTag,
  LocalizedTest,
  TestSpec,
  TestSummary,
  normalizeLocaleTag
} from "./types";
import { validateTestSpec } from "./validate";

let cachedTestsRoot: string | null = null;

const resolveTestsRoot = (): string => {
  if (cachedTestsRoot) {
    return cachedTestsRoot;
  }

  const start = process.cwd();
  let current = start;

  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = path.join(current, "content", "tests");
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      cachedTestsRoot = candidate;
      return candidate;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  throw new Error(`Content tests directory not found from ${start}`);
};

const readSpecFile = (testId: string, testsRoot: string): TestSpec => {
  const specPath = path.join(testsRoot, testId, "spec.json");
  if (!fs.existsSync(specPath)) {
    throw new Error(`Test spec ${testId} not found at ${specPath}`);
  }

  const raw = fs.readFileSync(specPath, "utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON for test ${testId}: ${message}`);
  }

  return validateTestSpec(parsed, testId);
};

export const listAllTests = (): TestSummary[] => {
  const testsRoot = resolveTestsRoot();
  const entries = fs.readdirSync(testsRoot, { withFileTypes: true });
  const summaries = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => readSpecFile(entry.name, testsRoot))
    .map((spec) => {
      const locales = Object.keys(spec.locales).sort() as LocaleTag[];
      return {
        test_id: spec.test_id,
        slug: spec.slug,
        category: spec.category,
        locales
      };
    })
    .sort((left, right) => left.test_id.localeCompare(right.test_id));

  return summaries;
};

export const loadTestSpecById = (testId: string): TestSpec => {
  const testsRoot = resolveTestsRoot();
  return readSpecFile(testId, testsRoot);
};

const expectLocalizedString = (
  value: string | undefined,
  testId: string,
  path: string
): string => {
  if (value === undefined || !value.trim()) {
    throw new Error(`Missing localized value for ${testId} at ${path}`);
  }

  return value;
};

export const loadLocalizedTest = (testId: string, locale: string): LocalizedTest => {
  const spec = loadTestSpecById(testId);
  const normalizedLocale = normalizeLocaleTag(locale);
  if (!normalizedLocale) {
    throw new Error(`Unsupported locale ${locale} for test ${testId}`);
  }

  const localeStrings = spec.locales[normalizedLocale];
  if (!localeStrings) {
    throw new Error(`Missing locale ${normalizedLocale} for test ${testId}`);
  }

  const questions = spec.questions.map((question, index) => {
    const prompt = expectLocalizedString(
      question.prompt[normalizedLocale],
      testId,
      `questions[${index}].prompt.${normalizedLocale}`
    );
    const options = question.options.map((option, optionIndex) => {
      const label = expectLocalizedString(
        option.label[normalizedLocale],
        testId,
        `questions[${index}].options[${optionIndex}].label.${normalizedLocale}`
      );
      return { id: option.id, label };
    });

    return {
      id: question.id,
      type: question.type,
      prompt,
      options
    };
  });

  return {
    test_id: spec.test_id,
    slug: spec.slug,
    category: spec.category,
    title: localeStrings.title,
    description: localeStrings.short_description,
    intro: localeStrings.intro,
    paywall_headline: localeStrings.paywall_headline,
    report_title: localeStrings.report_title,
    questions,
    scoring: spec.scoring,
    result_bands: spec.result_bands,
    locale: normalizedLocale
  };
};

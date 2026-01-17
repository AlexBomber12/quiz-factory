import {
  LocaleRecord,
  LocaleStrings,
  LocaleTag,
  ResultBand,
  ResultBandCopy,
  TestQuestion,
  TestScoring,
  TestSpec,
  normalizeLocaleTag
} from "./types";

const TEST_ID_PATTERN = /^test-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const fail = (testId: string, path: string, message: string): never => {
  throw new Error(`Invalid test spec ${testId}: ${message} at ${path}`);
};

const expectRecord = (value: unknown, testId: string, path: string): Record<string, unknown> => {
  if (!isRecord(value)) {
    fail(testId, path, "expected object");
  }

  return value as Record<string, unknown>;
};

const expectArray = (value: unknown, testId: string, path: string): unknown[] => {
  if (!Array.isArray(value)) {
    fail(testId, path, "expected array");
  }

  return value as unknown[];
};

const expectString = (value: unknown, testId: string, path: string): string => {
  if (value === undefined) {
    fail(testId, path, "missing required field");
  }

  if (typeof value !== "string") {
    fail(testId, path, "expected string");
  }

  const trimmed = (value as string).trim();
  if (!trimmed) {
    fail(testId, path, "must not be empty");
  }

  return trimmed;
};

const expectInteger = (value: unknown, testId: string, path: string): number => {
  if (value === undefined) {
    fail(testId, path, "missing required field");
  }

  if (typeof value !== "number" || !Number.isInteger(value)) {
    fail(testId, path, "expected integer");
  }

  return value as number;
};

const collectLocaleKeys = (
  locales: Record<string, unknown>,
  testId: string,
  path: string
): LocaleTag[] => {
  const keys = Object.keys(locales);
  if (keys.length === 0) {
    fail(testId, path, "must include at least one locale");
  }

  const normalized: LocaleTag[] = [];
  for (const key of keys) {
    const canonical = normalizeLocaleTag(key);
    if (!canonical) {
      fail(testId, `${path}.${key}`, "unsupported locale tag");
    }
    const normalizedLocale = canonical as LocaleTag;
    if (normalizedLocale !== key) {
      fail(testId, `${path}.${key}`, `locale tag must be ${normalizedLocale}`);
    }
    if (normalized.includes(normalizedLocale)) {
      fail(testId, `${path}.${key}`, "duplicate locale tag");
    }
    normalized.push(normalizedLocale);
  }

  return normalized;
};

const validateLocaleStrings = (
  value: unknown,
  testId: string,
  path: string
): LocaleStrings => {
  const record = expectRecord(value, testId, path);
  return {
    title: expectString(record.title, testId, `${path}.title`),
    short_description: expectString(record.short_description, testId, `${path}.short_description`),
    intro: expectString(record.intro, testId, `${path}.intro`),
    paywall_headline: expectString(record.paywall_headline, testId, `${path}.paywall_headline`),
    report_title: expectString(record.report_title, testId, `${path}.report_title`)
  };
};

const validateLocalizedStringMap = (
  value: unknown,
  localeKeys: LocaleTag[],
  testId: string,
  path: string
): LocaleRecord<string> => {
  const record = expectRecord(value, testId, path);
  const localized: LocaleRecord<string> = {};

  for (const locale of localeKeys) {
    localized[locale] = expectString(record[locale], testId, `${path}.${locale}`);
  }

  return localized;
};

const validateQuestion = (
  value: unknown,
  localeKeys: LocaleTag[],
  testId: string,
  path: string
): TestQuestion => {
  const record = expectRecord(value, testId, path);
  const id = expectString(record.id, testId, `${path}.id`);
  const type = expectString(record.type, testId, `${path}.type`);
  if (type !== "single_choice") {
    fail(testId, `${path}.type`, "only single_choice is supported");
  }

  const prompt = validateLocalizedStringMap(record.prompt, localeKeys, testId, `${path}.prompt`);
  const optionsRaw = expectArray(record.options, testId, `${path}.options`);
  const options = optionsRaw.map((option, index) => {
    const optionPath = `${path}.options[${index}]`;
    const optionRecord = expectRecord(option, testId, optionPath);
    const optionId = expectString(optionRecord.id, testId, `${optionPath}.id`);
    const label = validateLocalizedStringMap(
      optionRecord.label,
      localeKeys,
      testId,
      `${optionPath}.label`
    );
    return { id: optionId, label };
  });

  return { id, type: "single_choice", prompt, options };
};

const validateScoring = (value: unknown, testId: string, path: string): TestScoring => {
  const record = expectRecord(value, testId, path);
  const scalesRaw = expectArray(record.scales, testId, `${path}.scales`);
  const scales = scalesRaw.map((scale, index) =>
    expectString(scale, testId, `${path}.scales[${index}]`)
  );
  const weightsRaw = expectRecord(record.option_weights, testId, `${path}.option_weights`);
  const optionWeights: Record<string, Record<string, number>> = {};

  for (const [optionId, weights] of Object.entries(weightsRaw)) {
    const normalizedOptionId = expectString(optionId, testId, `${path}.option_weights.key`);
    const weightsRecord = expectRecord(
      weights,
      testId,
      `${path}.option_weights.${normalizedOptionId}`
    );
    const scaleWeights: Record<string, number> = {};

    for (const [scaleId, weight] of Object.entries(weightsRecord)) {
      const normalizedScaleId = expectString(
        scaleId,
        testId,
        `${path}.option_weights.${normalizedOptionId}.key`
      );
      if (weight === undefined) {
        fail(
          testId,
          `${path}.option_weights.${normalizedOptionId}.${normalizedScaleId}`,
          "missing required field"
        );
      }
      if (typeof weight !== "number" || !Number.isInteger(weight)) {
        fail(
          testId,
          `${path}.option_weights.${normalizedOptionId}.${normalizedScaleId}`,
          "expected integer"
        );
      }
      scaleWeights[normalizedScaleId] = weight as number;
    }

    optionWeights[normalizedOptionId] = scaleWeights;
  }

  return { scales, option_weights: optionWeights };
};

const validateResultBand = (
  value: unknown,
  localeKeys: LocaleTag[],
  testId: string,
  path: string
): ResultBand => {
  const record = expectRecord(value, testId, path);
  const bandId = expectString(record.band_id, testId, `${path}.band_id`);
  const minScore = expectInteger(record.min_score_inclusive, testId, `${path}.min_score_inclusive`);
  const maxScore = expectInteger(record.max_score_inclusive, testId, `${path}.max_score_inclusive`);

  const copyRecord = expectRecord(record.copy, testId, `${path}.copy`);
  const copy: LocaleRecord<ResultBandCopy> = {};

  for (const locale of localeKeys) {
    const localeCopyPath = `${path}.copy.${locale}`;
    const localized = expectRecord(copyRecord[locale], testId, localeCopyPath);
    const bulletsRaw = expectArray(localized.bullets, testId, `${localeCopyPath}.bullets`);
    const bullets = bulletsRaw.map((bullet, index) =>
      expectString(bullet, testId, `${localeCopyPath}.bullets[${index}]`)
    );

    copy[locale] = {
      headline: expectString(localized.headline, testId, `${localeCopyPath}.headline`),
      summary: expectString(localized.summary, testId, `${localeCopyPath}.summary`),
      bullets
    };
  }

  return {
    band_id: bandId,
    min_score_inclusive: minScore,
    max_score_inclusive: maxScore,
    copy
  };
};

export const validateTestSpec = (raw: unknown, sourceId: string): TestSpec => {
  const record = expectRecord(raw, sourceId, "spec");
  const testId = typeof record.test_id === "string" && record.test_id.trim()
    ? record.test_id.trim()
    : sourceId;
  const testIdValue = expectString(record.test_id, testId, "test_id");
  if (!TEST_ID_PATTERN.test(testIdValue)) {
    fail(testId, "test_id", "must match test-<slug>");
  }
  if (testIdValue !== sourceId) {
    fail(testId, "test_id", `must match directory ${sourceId}`);
  }

  const slug = expectString(record.slug, testIdValue, "slug");
  if (!SLUG_PATTERN.test(slug)) {
    fail(testIdValue, "slug", "must be url-safe");
  }
  if (testIdValue !== `test-${slug}`) {
    fail(testIdValue, "test_id", "must align with slug");
  }

  const version = expectInteger(record.version, testIdValue, "version");
  if (version < 1) {
    fail(testIdValue, "version", "must be >= 1");
  }
  const category = expectString(record.category, testIdValue, "category");

  const localesRaw = expectRecord(record.locales, testIdValue, "locales");
  const localeKeys = collectLocaleKeys(localesRaw, testIdValue, "locales");
  const locales: LocaleRecord<LocaleStrings> = {};
  for (const locale of localeKeys) {
    locales[locale] = validateLocaleStrings(
      localesRaw[locale],
      testIdValue,
      `locales.${locale}`
    );
  }

  const questionsRaw = expectArray(record.questions, testIdValue, "questions");
  const questions = questionsRaw.map((question, index) =>
    validateQuestion(question, localeKeys, testIdValue, `questions[${index}]`)
  );

  const scoring = validateScoring(record.scoring, testIdValue, "scoring");

  const resultBandsRaw = expectArray(record.result_bands, testIdValue, "result_bands");
  const resultBands = resultBandsRaw.map((band, index) =>
    validateResultBand(band, localeKeys, testIdValue, `result_bands[${index}]`)
  );

  return {
    test_id: testIdValue,
    slug,
    version,
    category,
    locales,
    questions,
    scoring,
    result_bands: resultBands
  };
};

export const ALLOWED_LOCALES = ["en", "es", "pt-BR"] as const;

export type LocaleTag = (typeof ALLOWED_LOCALES)[number];

export type LocaleRecord<T> = Partial<Record<LocaleTag, T>>;

export type LocaleStrings = {
  title: string;
  short_description: string;
  intro: string;
  paywall_headline: string;
  report_title: string;
};

export type QuestionOption = {
  id: string;
  label: LocaleRecord<string>;
};

export type TestQuestion = {
  id: string;
  type: "single_choice";
  prompt: LocaleRecord<string>;
  options: QuestionOption[];
};

export type TestScoring = {
  scales: string[];
  option_weights: Record<string, Record<string, number>>;
};

export type ResultBandCopy = {
  headline: string;
  summary: string;
  bullets: string[];
};

export type ResultBand = {
  band_id: string;
  min_score_inclusive: number;
  max_score_inclusive: number;
  copy: LocaleRecord<ResultBandCopy>;
};

export type TestSpec = {
  test_id: string;
  slug: string;
  version: number;
  category: string;
  locales: LocaleRecord<LocaleStrings>;
  questions: TestQuestion[];
  scoring: TestScoring;
  result_bands: ResultBand[];
};

export type LocalizedQuestionOption = {
  id: string;
  label: string;
};

export type LocalizedQuestion = {
  id: string;
  type: "single_choice";
  prompt: string;
  options: LocalizedQuestionOption[];
};

export type LocalizedTest = {
  test_id: string;
  slug: string;
  category: string;
  title: string;
  description: string;
  intro: string;
  paywall_headline: string;
  report_title: string;
  questions: LocalizedQuestion[];
  scoring: TestScoring;
  result_bands: ResultBand[];
  locale: LocaleTag;
};

export type TestSummary = {
  test_id: string;
  slug: string;
  category: string;
  locales: LocaleTag[];
};

const LOCALE_CANONICAL: Record<string, LocaleTag> = {
  "en": "en",
  "es": "es",
  "pt-br": "pt-BR"
};

export const normalizeLocaleTag = (value: string): LocaleTag | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return LOCALE_CANONICAL[trimmed.toLowerCase()] ?? null;
};

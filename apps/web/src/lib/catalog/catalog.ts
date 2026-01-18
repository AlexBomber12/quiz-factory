import catalogConfig from "../../../../../config/catalog.json";
import testIndexData from "../../../../../content/test_index.json";

import { loadTestSpecById } from "../content/load";
import { LocaleStrings, TestSpec, normalizeLocaleTag } from "../content/types";

type CatalogConfig = {
  tenants?: Record<string, string[]>;
};

type TestIndexEntry = {
  test_id: string;
  estimated_minutes: number;
};

type TestIndex = {
  tests?: TestIndexEntry[];
};

export type CatalogTest = {
  test_id: string;
  slug: string;
  title: string;
  short_description: string;
  estimated_minutes: number;
};

type LoaderOptions = {
  catalog?: CatalogConfig;
  testIndex?: TestIndex;
};

const FALLBACK_LOCALE = "en";
const DEFAULT_CATALOG = catalogConfig as CatalogConfig;
const DEFAULT_TEST_INDEX = testIndexData as TestIndex;

const resolveLocaleStrings = (spec: TestSpec, locale: string): LocaleStrings => {
  const normalized = normalizeLocaleTag(locale);
  if (normalized && spec.locales[normalized]) {
    return spec.locales[normalized];
  }

  if (spec.locales[FALLBACK_LOCALE]) {
    return spec.locales[FALLBACK_LOCALE];
  }

  const [first] = Object.values(spec.locales);
  if (first) {
    return first;
  }

  throw new Error(`No locale strings available for test ${spec.test_id}`);
};

const loadTestMetadata = (
  testId: string,
  entries: TestIndexEntry[],
  tenantId: string
): TestIndexEntry => {
  const match = entries.find((entry) => entry.test_id === testId);
  if (!match) {
    throw new Error(
      `Catalog metadata missing for test ${testId} in content/test_index.json for tenant ${tenantId}`
    );
  }

  if (!Number.isInteger(match.estimated_minutes)) {
    throw new Error(
      `Catalog metadata for test ${testId} must include estimated_minutes integer`
    );
  }

  return match;
};

export const loadTenantCatalog = (
  tenantId: string,
  locale: string,
  options: LoaderOptions = {}
): CatalogTest[] => {
  const catalog = options.catalog ?? DEFAULT_CATALOG;
  const testIndex = options.testIndex ?? DEFAULT_TEST_INDEX;
  const testIds = catalog.tenants?.[tenantId] ?? [];
  if (testIds.length === 0) {
    return [];
  }

  const entries = testIndex.tests ?? [];

  return testIds.map((testId) => {
    const metadata = loadTestMetadata(testId, entries, tenantId);
    const spec = loadTestSpecById(testId);
    const strings = resolveLocaleStrings(spec, locale);

    return {
      test_id: spec.test_id,
      slug: spec.slug,
      title: strings.title,
      short_description: strings.short_description,
      estimated_minutes: metadata.estimated_minutes
    };
  });
};

export const resolveTenantTestBySlug = (
  tenantId: string,
  locale: string,
  slug: string
): CatalogTest | null => {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) {
    return null;
  }

  const tests = loadTenantCatalog(tenantId, locale);
  return tests.find((test) => test.slug === normalizedSlug) ?? null;
};

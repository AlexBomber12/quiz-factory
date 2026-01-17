import catalogConfig from "../../../../../config/catalog.json";

import { loadTestSpecById, listAllTests } from "./load";
import { LocaleStrings, TestSpec, normalizeLocaleTag } from "./types";

type CatalogConfig = {
  tenants?: Record<string, string[]>;
};

export type CatalogTest = {
  test_id: string;
  slug: string;
  title: string;
  short_description: string;
};

const catalogTenants = (catalogConfig as CatalogConfig).tenants ?? {};
const FALLBACK_LOCALE = "en";

const resolveLocaleStrings = (spec: TestSpec, locale: string): LocaleStrings | null => {
  const normalized = normalizeLocaleTag(locale);
  if (normalized && spec.locales[normalized]) {
    return spec.locales[normalized];
  }

  if (spec.locales[FALLBACK_LOCALE]) {
    return spec.locales[FALLBACK_LOCALE];
  }

  const [first] = Object.values(spec.locales);
  return first ?? null;
};

const buildCatalogTest = (testId: string, locale: string): CatalogTest | null => {
  const spec = loadTestSpecById(testId);
  const strings = resolveLocaleStrings(spec, locale);
  if (!strings) {
    return null;
  }

  return {
    test_id: spec.test_id,
    slug: spec.slug,
    title: strings.title,
    short_description: strings.short_description
  };
};

export const getTenantTestIds = (tenantId: string): string[] => {
  return catalogTenants[tenantId] ?? [];
};

export const loadTenantCatalog = (tenantId: string, locale: string): CatalogTest[] => {
  const testIds = getTenantTestIds(tenantId);
  if (testIds.length === 0) {
    return [];
  }

  const tests: CatalogTest[] = [];
  for (const testId of testIds) {
    const entry = buildCatalogTest(testId, locale);
    if (entry) {
      tests.push(entry);
    }
  }

  return tests;
};

export const resolveTestIdBySlug = (slug: string): string | null => {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) {
    return null;
  }

  const tests = listAllTests();
  const match = tests.find((test) => test.slug === normalizedSlug);
  return match?.test_id ?? null;
};

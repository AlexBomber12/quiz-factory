import testIndexData from "../../../../../content/test_index.json";

import { listCatalogForTenant, loadPublishedTestBySlug } from "../content/provider";

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
  testIndex?: TestIndex;
};

const DEFAULT_TEST_INDEX = testIndexData as TestIndex;

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
): Promise<CatalogTest[]> => {
  const testIndex = options.testIndex ?? DEFAULT_TEST_INDEX;
  return loadTenantCatalogWithIndex(tenantId, locale, testIndex);
};

const loadTenantCatalogWithIndex = async (
  tenantId: string,
  locale: string,
  testIndex: TestIndex
): Promise<CatalogTest[]> => {
  const catalog = await listCatalogForTenant(tenantId);
  if (catalog.length === 0) {
    return [];
  }

  const entries = testIndex.tests ?? [];
  const tests: CatalogTest[] = [];

  for (const entry of catalog) {
    const metadata = loadTestMetadata(entry.test_id, entries, tenantId);
    const published = await loadPublishedTestBySlug(tenantId, entry.slug, locale);
    if (!published) {
      continue;
    }

    tests.push({
      test_id: published.test_id,
      slug: published.slug,
      title: published.test.title,
      short_description: published.test.description,
      estimated_minutes: metadata.estimated_minutes
    });
  }

  return tests;
};

export const resolveTenantTestBySlug = (
  tenantId: string,
  locale: string,
  slug: string
): Promise<CatalogTest | null> => {
  return resolveTenantTestBySlugWithIndex(tenantId, locale, slug, DEFAULT_TEST_INDEX);
};

const resolveTenantTestBySlugWithIndex = async (
  tenantId: string,
  locale: string,
  slug: string,
  testIndex: TestIndex
): Promise<CatalogTest | null> => {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) {
    return null;
  }

  const tests = await loadTenantCatalogWithIndex(tenantId, locale, testIndex);
  return tests.find((test) => test.slug === normalizedSlug) ?? null;
};

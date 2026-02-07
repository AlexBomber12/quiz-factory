import {
  getPublishedTestBySlug as getPublishedTestBySlugFromDb,
  getTenantCatalog as getTenantCatalogFromDb
} from "../content_db/repo";
import { getTenantTestIds, resolveTestIdBySlug } from "./catalog";
import { loadTestSpecById, loadValuesCompassSpecById, localizeTestSpec } from "./load";
import { LocaleTag, LocalizedTest, TestSpec, normalizeLocaleTag } from "./types";

export type ContentSource = "fs" | "db";

export type TenantCatalogRecord = {
  tenant_id: string;
  test_id: string;
  slug: string;
  default_locale: LocaleTag;
};

export type PublishedTenantTest = {
  tenant_id: string;
  test_id: string;
  slug: string;
  default_locale: LocaleTag;
  locale: LocaleTag;
  spec: TestSpec;
  test: LocalizedTest;
};

const DEFAULT_CONTENT_SOURCE: ContentSource = "fs";

const resolveContentSource = (): ContentSource => {
  const rawSource = process.env.CONTENT_SOURCE;
  if (!rawSource) {
    return DEFAULT_CONTENT_SOURCE;
  }

  return rawSource.trim().toLowerCase() === "db" ? "db" : DEFAULT_CONTENT_SOURCE;
};

const normalizeTenantId = (tenantId: string): string => tenantId.trim();

const normalizeSlug = (slug: string): string => slug.trim().toLowerCase();

const normalizeTestId = (testId: string): string => testId.trim();

const resolveDefaultLocale = (spec: TestSpec): LocaleTag => {
  if (spec.locales.en) {
    return "en";
  }

  const locale = Object.keys(spec.locales)
    .map((candidate) => normalizeLocaleTag(candidate))
    .find((candidate): candidate is LocaleTag => candidate !== null);
  if (locale && spec.locales[locale]) {
    return locale;
  }

  throw new Error(`Test ${spec.test_id} does not define any supported locale.`);
};

const listCatalogFromFilesystem = (tenantId: string): TenantCatalogRecord[] => {
  const normalizedTenantId = normalizeTenantId(tenantId);
  if (!normalizedTenantId) {
    return [];
  }

  const testIds = getTenantTestIds(normalizedTenantId);
  const catalog: TenantCatalogRecord[] = [];

  for (const testId of testIds) {
    const spec = loadValuesCompassSpecById(testId);
    if (!spec) {
      continue;
    }

    catalog.push({
      tenant_id: normalizedTenantId,
      test_id: spec.test_id,
      slug: spec.slug,
      default_locale: resolveDefaultLocale(spec)
    });
  }

  return catalog;
};

const listCatalogFromDatabase = async (tenantId: string): Promise<TenantCatalogRecord[]> => {
  const normalizedTenantId = normalizeTenantId(tenantId);
  if (!normalizedTenantId) {
    return [];
  }

  const rows = await getTenantCatalogFromDb(normalizedTenantId);
  return rows.map((row) => ({
    tenant_id: row.tenant_id,
    test_id: row.test_id,
    slug: row.slug,
    default_locale: normalizeLocaleTag(row.default_locale) ?? "en"
  }));
};

export const listCatalogForTenant = async (
  tenantId: string
): Promise<TenantCatalogRecord[]> => {
  if (resolveContentSource() === "db") {
    return listCatalogFromDatabase(tenantId);
  }

  return listCatalogFromFilesystem(tenantId);
};

const loadPublishedFromFilesystem = (
  tenantId: string,
  slug: string,
  locale: string
): PublishedTenantTest | null => {
  const normalizedTenantId = normalizeTenantId(tenantId);
  const normalizedSlug = normalizeSlug(slug);
  if (!normalizedTenantId || !normalizedSlug) {
    return null;
  }

  const testId = resolveTestIdBySlug(normalizedSlug);
  if (!testId) {
    return null;
  }

  const allowedTests = getTenantTestIds(normalizedTenantId);
  if (!allowedTests.includes(testId)) {
    return null;
  }

  const spec = loadTestSpecById(testId);
  const test = localizeTestSpec(spec, locale);

  return {
    tenant_id: normalizedTenantId,
    test_id: spec.test_id,
    slug: spec.slug,
    default_locale: resolveDefaultLocale(spec),
    locale: test.locale,
    spec,
    test
  };
};

const loadPublishedFromDatabase = async (
  tenantId: string,
  slug: string,
  locale: string
): Promise<PublishedTenantTest | null> => {
  const normalizedTenantId = normalizeTenantId(tenantId);
  const normalizedSlug = normalizeSlug(slug);
  if (!normalizedTenantId || !normalizedSlug) {
    return null;
  }

  const published = await getPublishedTestBySlugFromDb(normalizedTenantId, normalizedSlug, locale);
  if (!published) {
    return null;
  }

  const test = localizeTestSpec(published.spec, published.locale);

  return {
    tenant_id: published.tenant_id,
    test_id: published.test_id,
    slug: published.slug,
    default_locale: normalizeLocaleTag(published.default_locale) ?? test.locale,
    locale: published.locale,
    spec: published.spec,
    test
  };
};

export const loadPublishedTestBySlug = async (
  tenantId: string,
  slug: string,
  locale: string
): Promise<PublishedTenantTest | null> => {
  if (resolveContentSource() === "db") {
    return loadPublishedFromDatabase(tenantId, slug, locale);
  }

  return loadPublishedFromFilesystem(tenantId, slug, locale);
};

export const loadPublishedTestById = async (
  tenantId: string,
  testId: string,
  locale: string
): Promise<PublishedTenantTest | null> => {
  const normalizedTestId = normalizeTestId(testId);
  if (!normalizedTestId) {
    return null;
  }

  const catalog = await listCatalogForTenant(tenantId);
  const match = catalog.find((entry) => entry.test_id === normalizedTestId);
  if (!match) {
    return null;
  }

  return loadPublishedTestBySlug(tenantId, match.slug, locale);
};


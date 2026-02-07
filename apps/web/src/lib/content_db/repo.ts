import { LocaleTag, TestSpec, normalizeLocaleTag } from "../content/types";
import { validateTestSpec } from "../content/validate";

import { getContentDbPool } from "./pool";
import {
  CONTENT_REPO_CACHE_TTL_MS,
  buildPublishedTestCacheKey,
  buildTenantCatalogCacheKey,
  createContentRepoCache
} from "./repo_cache";

type TimestampValue = Date | string;

type TenantCatalogRow = {
  tenant_id: string;
  test_id: string;
  slug: string;
  default_locale: string;
  is_enabled: boolean;
  published_version_id: string | null;
  published_version: number | null;
  published_at: TimestampValue | null;
};

type PublishedTestRow = {
  tenant_id: string;
  test_id: string;
  slug: string;
  default_locale: string;
  published_version_id: string;
  published_version: number;
  published_at: TimestampValue | null;
  spec_json: unknown;
};

type TestRow = {
  id: string;
  test_id: string;
  slug: string;
  default_locale: string;
  created_at: TimestampValue;
  updated_at: TimestampValue;
};

type TestVersionRow = {
  id: string;
  test_id: string;
  version: number;
  status: "draft" | "archived";
  spec_json: unknown;
  source_import_id: string | null;
  checksum: string;
  created_at: TimestampValue;
  created_by: string | null;
};

export type TenantCatalogEntry = {
  tenant_id: string;
  test_id: string;
  slug: string;
  default_locale: string;
  is_enabled: boolean;
  published_version_id: string;
  published_version: number;
  published_at: string | null;
};

export type PublishedTestBySlug = {
  tenant_id: string;
  test_id: string;
  slug: string;
  default_locale: string;
  published_version_id: string;
  published_version: number;
  published_at: string | null;
  locale: LocaleTag;
  spec: TestSpec;
};

export type ContentTestRecord = {
  id: string;
  test_id: string;
  slug: string;
  default_locale: string;
  created_at: string;
  updated_at: string;
};

export type TestVersionRecord = {
  id: string;
  test_id: string;
  version: number;
  status: "draft" | "archived";
  spec_json: unknown;
  source_import_id: string | null;
  checksum: string;
  created_at: string;
  created_by: string | null;
};

const repoCache = createContentRepoCache({ ttlMs: CONTENT_REPO_CACHE_TTL_MS });

const normalizeTenantId = (tenantId: string): string => tenantId.trim();

const normalizeSlug = (slug: string): string => slug.trim().toLowerCase();

const normalizeTestId = (testId: string): string => testId.trim();

const toIsoString = (value: TimestampValue | null): string | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
};

const resolveSpecLocale = (
  spec: TestSpec,
  requestedLocale: string,
  defaultLocale: string
): LocaleTag => {
  const requested = normalizeLocaleTag(requestedLocale);
  if (requested && spec.locales[requested]) {
    return requested;
  }

  const fallback = normalizeLocaleTag(defaultLocale);
  if (fallback && spec.locales[fallback]) {
    return fallback;
  }

  if (spec.locales.en) {
    return "en";
  }

  const [firstLocale] = Object.keys(spec.locales)
    .map((locale) => normalizeLocaleTag(locale))
    .filter((locale): locale is LocaleTag => locale !== null);
  if (firstLocale && spec.locales[firstLocale]) {
    return firstLocale;
  }

  throw new Error(`Published test ${spec.test_id} does not define any supported locale.`);
};

export const getTenantCatalog = async (tenantId: string): Promise<TenantCatalogEntry[]> => {
  const normalizedTenantId = normalizeTenantId(tenantId);
  if (!normalizedTenantId) {
    return [];
  }

  const cacheKey = buildTenantCatalogCacheKey(normalizedTenantId);
  const cached = repoCache.read<TenantCatalogEntry[]>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const pool = getContentDbPool();
  const { rows } = await pool.query<TenantCatalogRow>(
    `
      SELECT
        tt.tenant_id,
        t.test_id,
        t.slug,
        t.default_locale,
        tt.is_enabled,
        tt.published_version_id,
        tv.version AS published_version,
        tt.published_at
      FROM tenant_tests tt
      JOIN tests t
        ON t.id = tt.test_id
      LEFT JOIN test_versions tv
        ON tv.id = tt.published_version_id
      WHERE tt.tenant_id = $1
        AND tt.is_enabled = TRUE
        AND tt.published_version_id IS NOT NULL
      ORDER BY t.slug ASC
    `,
    [normalizedTenantId]
  );

  const catalog = rows
    .filter(
      (
        row
      ): row is TenantCatalogRow & { published_version_id: string; published_version: number } =>
        row.published_version_id !== null && row.published_version !== null
    )
    .map((row) => ({
      tenant_id: row.tenant_id,
      test_id: row.test_id,
      slug: row.slug,
      default_locale: row.default_locale,
      is_enabled: row.is_enabled,
      published_version_id: row.published_version_id,
      published_version: row.published_version,
      published_at: toIsoString(row.published_at)
    }));

  return repoCache.write({
    key: cacheKey,
    tenantId: normalizedTenantId,
    testIds: catalog.map((entry) => entry.test_id),
    value: catalog
  });
};

export const getPublishedTestBySlug = async (
  tenantId: string,
  slug: string,
  locale: string
): Promise<PublishedTestBySlug | null> => {
  const normalizedTenantId = normalizeTenantId(tenantId);
  const normalizedSlug = normalizeSlug(slug);
  if (!normalizedTenantId || !normalizedSlug) {
    return null;
  }

  const cacheKey = buildPublishedTestCacheKey(normalizedTenantId, normalizedSlug, locale);
  const cached = repoCache.read<PublishedTestBySlug>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const pool = getContentDbPool();
  const { rows } = await pool.query<PublishedTestRow>(
    `
      SELECT
        tt.tenant_id,
        t.test_id,
        t.slug,
        t.default_locale,
        tt.published_version_id,
        tv.version AS published_version,
        tt.published_at,
        tv.spec_json
      FROM tenant_tests tt
      JOIN tests t
        ON t.id = tt.test_id
      JOIN test_versions tv
        ON tv.id = tt.published_version_id
      WHERE tt.tenant_id = $1
        AND t.slug = $2
        AND tt.is_enabled = TRUE
      LIMIT 1
    `,
    [normalizedTenantId, normalizedSlug]
  );

  const row = rows[0];
  if (!row) {
    return null;
  }

  const spec = validateTestSpec(row.spec_json, row.test_id);
  const resolvedLocale = resolveSpecLocale(spec, locale, row.default_locale);
  const publishedTest: PublishedTestBySlug = {
    tenant_id: row.tenant_id,
    test_id: row.test_id,
    slug: row.slug,
    default_locale: row.default_locale,
    published_version_id: row.published_version_id,
    published_version: row.published_version,
    published_at: toIsoString(row.published_at),
    locale: resolvedLocale,
    spec
  };

  return repoCache.write({
    key: cacheKey,
    tenantId: normalizedTenantId,
    testIds: [row.test_id],
    value: publishedTest
  });
};

export const getTestById = async (testId: string): Promise<ContentTestRecord | null> => {
  const normalizedTestId = normalizeTestId(testId);
  if (!normalizedTestId) {
    return null;
  }

  const pool = getContentDbPool();
  const { rows } = await pool.query<TestRow>(
    `
      SELECT
        id,
        test_id,
        slug,
        default_locale,
        created_at,
        updated_at
      FROM tests
      WHERE test_id = $1
      LIMIT 1
    `,
    [normalizedTestId]
  );

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    test_id: row.test_id,
    slug: row.slug,
    default_locale: row.default_locale,
    created_at: toIsoString(row.created_at) ?? "",
    updated_at: toIsoString(row.updated_at) ?? ""
  };
};

export const listVersions = async (testId: string): Promise<TestVersionRecord[]> => {
  const normalizedTestId = normalizeTestId(testId);
  if (!normalizedTestId) {
    return [];
  }

  const pool = getContentDbPool();
  const { rows } = await pool.query<TestVersionRow>(
    `
      SELECT
        tv.id,
        t.test_id,
        tv.version,
        tv.status,
        tv.spec_json,
        tv.source_import_id,
        tv.checksum,
        tv.created_at,
        tv.created_by
      FROM test_versions tv
      JOIN tests t
        ON t.id = tv.test_id
      WHERE t.test_id = $1
      ORDER BY tv.version DESC
    `,
    [normalizedTestId]
  );

  return rows.map((row) => ({
    id: row.id,
    test_id: row.test_id,
    version: row.version,
    status: row.status,
    spec_json: row.spec_json,
    source_import_id: row.source_import_id,
    checksum: row.checksum,
    created_at: toIsoString(row.created_at) ?? "",
    created_by: row.created_by
  }));
};

export const invalidateTenant = (tenantId: string): void => {
  const normalizedTenantId = normalizeTenantId(tenantId);
  if (!normalizedTenantId) {
    return;
  }

  repoCache.invalidateTenant(normalizedTenantId);
};

export const invalidateTest = (testId: string): void => {
  const normalizedTestId = normalizeTestId(testId);
  if (!normalizedTestId) {
    return;
  }

  repoCache.invalidateTest(normalizedTestId);
};

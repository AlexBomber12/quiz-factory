import {
  getPublishedProductBySlug as getPublishedProductBySlugFromDb,
  listTenantProducts as listTenantProductsFromDb,
  type TenantPublishedProductRecord
} from "../content_db/products_repo";
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

export type ProductAttribute = {
  key: string;
  value: string;
};

export type LocalizedProduct = {
  title: string;
  description: string;
  price: string | null;
  images: string[];
  attributes: ProductAttribute[];
};

export type PublishedTenantProduct = {
  tenant_id: string;
  product_id: string;
  slug: string;
  published_version_id: string;
  published_version: number;
  published_at: string | null;
  default_locale: LocaleTag;
  locale: LocaleTag;
  spec: Record<string, unknown>;
  product: LocalizedProduct;
};

export type TenantProductCatalogRecord = {
  tenant_id: string;
  product_id: string;
  slug: string;
  default_locale: LocaleTag;
  locale: LocaleTag;
  title: string;
  description: string;
  price: string | null;
};

const DEFAULT_CONTENT_SOURCE: ContentSource = "fs";
const DEFAULT_PRODUCT_LOCALE: LocaleTag = "en";

export const resolveContentSource = (): ContentSource => {
  const rawSource = process.env.CONTENT_SOURCE;
  if (!rawSource) {
    return DEFAULT_CONTENT_SOURCE;
  }

  return rawSource.trim().toLowerCase() === "db" ? "db" : DEFAULT_CONTENT_SOURCE;
};

const normalizeTenantId = (tenantId: string): string => tenantId.trim();

const normalizeSlug = (slug: string): string => slug.trim().toLowerCase();

const normalizeTestId = (testId: string): string => testId.trim();

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asLocaleObject = (value: unknown): Record<string, unknown> => {
  if (!isObjectRecord(value)) {
    return {};
  }

  return value;
};

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

const resolveProductLocaleMap = (spec: Record<string, unknown>): Map<LocaleTag, Record<string, unknown>> => {
  const localeMap = new Map<LocaleTag, Record<string, unknown>>();
  const locales = spec.locales;
  if (!isObjectRecord(locales)) {
    return localeMap;
  }

  for (const [key, value] of Object.entries(locales)) {
    const localeTag = normalizeLocaleTag(key);
    if (!localeTag || !isObjectRecord(value)) {
      continue;
    }

    localeMap.set(localeTag, value);
  }

  return localeMap;
};

const resolveProductDefaultLocale = (
  spec: Record<string, unknown>,
  localeMap: Map<LocaleTag, Record<string, unknown>>
): LocaleTag => {
  const explicitRaw = asNonEmptyString(spec.default_locale);
  const explicit = explicitRaw ? normalizeLocaleTag(explicitRaw) : null;
  if (explicit && localeMap.has(explicit)) {
    return explicit;
  }

  if (localeMap.has("en")) {
    return "en";
  }

  const firstLocale = localeMap.keys().next().value;
  if (firstLocale) {
    return firstLocale;
  }

  return DEFAULT_PRODUCT_LOCALE;
};

const resolveProductLocale = (
  requestedLocale: string,
  defaultLocale: LocaleTag,
  localeMap: Map<LocaleTag, Record<string, unknown>>
): LocaleTag => {
  const requested = normalizeLocaleTag(requestedLocale);
  if (requested && localeMap.has(requested)) {
    return requested;
  }

  if (localeMap.has(defaultLocale)) {
    return defaultLocale;
  }

  if (localeMap.has("en")) {
    return "en";
  }

  const firstLocale = localeMap.keys().next().value;
  if (firstLocale) {
    return firstLocale;
  }

  return defaultLocale;
};

const resolvePriceLabel = (value: unknown): string | null => {
  const direct = asNonEmptyString(value);
  if (direct) {
    return direct;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (!isObjectRecord(value)) {
    return null;
  }

  const labeled = asNonEmptyString(value.label);
  if (labeled) {
    return labeled;
  }

  const amountRaw = value.amount;
  const currency = asNonEmptyString(value.currency)?.toUpperCase() ?? null;
  if (typeof amountRaw === "number" && Number.isFinite(amountRaw)) {
    return currency ? `${amountRaw} ${currency}` : String(amountRaw);
  }

  const amountText = asNonEmptyString(amountRaw);
  if (amountText) {
    return currency ? `${amountText} ${currency}` : amountText;
  }

  return null;
};

const resolveImages = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => asNonEmptyString(entry))
    .filter((entry): entry is string => entry !== null);
};

const resolveAttributes = (value: unknown): ProductAttribute[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (!isObjectRecord(entry)) {
          const label = asNonEmptyString(entry);
          if (!label) {
            return null;
          }

          return {
            key: label,
            value: ""
          };
        }

        const key =
          asNonEmptyString(entry.key) ??
          asNonEmptyString(entry.name) ??
          asNonEmptyString(entry.label);
        const resolvedValue =
          asNonEmptyString(entry.value) ??
          asNonEmptyString(entry.text) ??
          asNonEmptyString(entry.description) ??
          "";
        if (!key) {
          return null;
        }

        return {
          key,
          value: resolvedValue
        };
      })
      .filter((entry): entry is ProductAttribute => entry !== null);
  }

  if (!isObjectRecord(value)) {
    return [];
  }

  return Object.entries(value)
    .map(([key, entry]) => {
      const normalizedKey = asNonEmptyString(key);
      const normalizedValue = asNonEmptyString(entry);
      if (!normalizedKey || !normalizedValue) {
        return null;
      }

      return {
        key: normalizedKey,
        value: normalizedValue
      };
    })
    .filter((entry): entry is ProductAttribute => entry !== null);
};

const localizeProduct = (
  row: TenantPublishedProductRecord,
  requestedLocale: string
): PublishedTenantProduct => {
  const spec = asLocaleObject(row.spec);
  const localeMap = resolveProductLocaleMap(spec);
  const defaultLocale = resolveProductDefaultLocale(spec, localeMap);
  const locale = resolveProductLocale(requestedLocale, defaultLocale, localeMap);
  const localeFields = localeMap.get(locale) ?? {};

  const title = asNonEmptyString(localeFields.title) ?? asNonEmptyString(spec.title) ?? row.slug;
  const description =
    asNonEmptyString(localeFields.description) ?? asNonEmptyString(spec.description) ?? "";
  const price =
    resolvePriceLabel(localeFields.price) ??
    resolvePriceLabel(localeFields.price_label) ??
    resolvePriceLabel(spec.price) ??
    resolvePriceLabel(spec.price_label);
  const images = resolveImages(localeFields.images).concat(resolveImages(spec.images));
  const attributes =
    resolveAttributes(localeFields.attributes).length > 0
      ? resolveAttributes(localeFields.attributes)
      : resolveAttributes(spec.attributes);

  return {
    tenant_id: row.tenant_id,
    product_id: row.product_id,
    slug: row.slug,
    published_version_id: row.published_version_id,
    published_version: row.published_version,
    published_at: row.published_at,
    default_locale: defaultLocale,
    locale,
    spec,
    product: {
      title,
      description,
      price,
      images,
      attributes
    }
  };
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

export const listTenantProducts = async (
  tenantId: string,
  locale: string
): Promise<TenantProductCatalogRecord[]> => {
  const normalizedTenantId = normalizeTenantId(tenantId);
  if (!normalizedTenantId) {
    return [];
  }

  if (resolveContentSource() !== "db") {
    return [];
  }

  const products = await listTenantProductsFromDb(normalizedTenantId);
  return products.map((product) => {
    const localized = localizeProduct(product, locale);
    return {
      tenant_id: localized.tenant_id,
      product_id: localized.product_id,
      slug: localized.slug,
      default_locale: localized.default_locale,
      locale: localized.locale,
      title: localized.product.title,
      description: localized.product.description,
      price: localized.product.price
    };
  });
};

export const loadPublishedProductBySlug = async (
  tenantId: string,
  slug: string,
  locale: string
): Promise<PublishedTenantProduct | null> => {
  const normalizedTenantId = normalizeTenantId(tenantId);
  const normalizedSlug = normalizeSlug(slug);
  if (!normalizedTenantId || !normalizedSlug) {
    return null;
  }

  if (resolveContentSource() !== "db") {
    return null;
  }

  const published = await getPublishedProductBySlugFromDb(normalizedTenantId, normalizedSlug);
  if (!published) {
    return null;
  }

  return localizeProduct(published, locale);
};

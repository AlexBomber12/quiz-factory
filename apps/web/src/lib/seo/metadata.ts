import { createHash } from "node:crypto";

import catalogConfig from "../../../../../config/catalog.json";

import { loadValuesCompassSpecById } from "../content/load";
import type { LocaleTag, TestSpec } from "../content/types";
import { buildCanonicalUrl, type TenantRequestContext } from "../tenants/request";

type CatalogConfig = {
  tenants?: Record<string, string[]>;
};

type LastmodResult = {
  lastmod: string;
  token: string;
};

const DEFAULT_CATALOG = catalogConfig as CatalogConfig;

const LASTMOD_BASE_MS = Date.UTC(2024, 0, 1, 0, 0, 0);
const LASTMOD_DAY_RANGE = 365 * 20;
const DAY_MS = 24 * 60 * 60 * 1000;
const SECOND_MS = 1000;
const LOCALE_FALLBACK: LocaleTag = "en";
// Capture a process-stable "now" so lastmod never claims a future date while
// avoiding per-request drift.
const LASTMOD_MAX_MS = Date.now();

const normalizePath = (path: string): string => {
  return path.startsWith("/") ? path : `/${path}`;
};

const stableStringify = (value: unknown): string => {
  if (value === undefined) {
    return "null";
  }

  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    const parts = value.map((entry) => stableStringify(entry));
    return `[${parts.join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right)
  );
  const parts = entries.map(
    ([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`
  );
  return `{${parts.join(",")}}`;
};

const hashSeed = (seed: unknown): string => {
  const encoded = stableStringify(seed);
  return createHash("sha1").update(encoded).digest("hex");
};

const hashToLastmod = (hashHex: string): string => {
  const numericSeed = Number.parseInt(hashHex.slice(0, 12), 16);
  if (LASTMOD_MAX_MS <= LASTMOD_BASE_MS) {
    return new Date(LASTMOD_MAX_MS).toISOString();
  }

  const availableDays = Math.max(1, Math.floor((LASTMOD_MAX_MS - LASTMOD_BASE_MS) / DAY_MS));
  const dayRange = Math.max(1, Math.min(LASTMOD_DAY_RANGE, availableDays));
  const dayOffset = numericSeed % dayRange;
  const secondOffset = Math.floor(numericSeed / dayRange) % (DAY_MS / SECOND_MS);
  const timestamp = LASTMOD_BASE_MS + dayOffset * DAY_MS + secondOffset * SECOND_MS;
  const clampedTimestamp = Math.min(timestamp, LASTMOD_MAX_MS);
  return new Date(clampedTimestamp).toISOString();
};

const computeLastmod = (seed: unknown): LastmodResult => {
  const hashHex = hashSeed(seed);
  return {
    lastmod: hashToLastmod(hashHex),
    token: hashHex.slice(0, 12)
  };
};

const resolveTenantTestIds = (tenantId: string, catalog: CatalogConfig = DEFAULT_CATALOG): string[] => {
  const ids = catalog.tenants?.[tenantId] ?? [];
  return [...ids];
};

const resolveSpec = (testId: string): TestSpec | null => {
  try {
    return loadValuesCompassSpecById(testId);
  } catch {
    return null;
  }
};

const extractSpecLocales = (spec: TestSpec | null): LocaleTag[] => {
  if (!spec) {
    return [LOCALE_FALLBACK];
  }

  const locales = Object.keys(spec.locales).sort() as LocaleTag[];
  return locales.length > 0 ? locales : [LOCALE_FALLBACK];
};

const buildTenantLocales = (testIds: ReadonlyArray<string>): LocaleTag[] => {
  const localeSet = new Set<LocaleTag>();
  for (const testId of testIds) {
    const spec = resolveSpec(testId);
    for (const locale of extractSpecLocales(spec)) {
      localeSet.add(locale);
    }
  }

  if (localeSet.size === 0) {
    return [LOCALE_FALLBACK];
  }

  return [...localeSet].sort();
};

const buildLocaleAlternates = (
  context: TenantRequestContext,
  path: string,
  locales: ReadonlyArray<LocaleTag>
): Record<string, string> | undefined => {
  const canonical = buildCanonicalUrl(context, path);
  if (!canonical) {
    return undefined;
  }

  const alternates: Record<string, string> = {};
  for (const locale of locales) {
    alternates[locale] = canonical;
  }
  return alternates;
};

const toOpenGraphLocale = (locale: LocaleTag): string => {
  const [languagePart, regionPart] = locale.split("-");
  if (!regionPart) {
    return languagePart;
  }

  return `${languagePart}_${regionPart.toUpperCase()}`;
};

export const buildTenantLabel = (context: TenantRequestContext): string => {
  return context.requestHost ?? context.host ?? context.tenantId;
};

export const buildCanonical = (
  context: TenantRequestContext,
  path: string
): string | null => {
  return buildCanonicalUrl(context, normalizePath(path));
};

export const resolveSeoTestContext = (options: {
  tenantId: string;
  testId: string;
  catalog?: CatalogConfig;
}) => {
  const catalog = options.catalog ?? DEFAULT_CATALOG;
  const testIds = resolveTenantTestIds(options.tenantId, catalog);
  const spec = resolveSpec(options.testId);
  const locales = extractSpecLocales(spec);

  const seed = {
    tenant_id: options.tenantId,
    catalog: testIds,
    test_id: options.testId,
    spec
  };

  const { lastmod, token } = computeLastmod(seed);

  return {
    spec,
    locales,
    lastmod,
    token
  };
};

export const resolveTenantSeoContext = (options: {
  tenantId: string;
  catalog?: CatalogConfig;
}) => {
  const catalog = options.catalog ?? DEFAULT_CATALOG;
  const testIds = resolveTenantTestIds(options.tenantId, catalog);
  const specs = testIds.map((testId) => resolveSpec(testId));
  const locales = buildTenantLocales(testIds);

  const seed = {
    tenant_id: options.tenantId,
    catalog: testIds,
    specs
  };

  const { lastmod, token } = computeLastmod(seed);

  return {
    testIds,
    locales,
    lastmod,
    token
  };
};

export const buildOgImagePath = (
  basePath: string,
  token: string | null | undefined
): string => {
  const normalizedPath = normalizePath(basePath);
  if (!token) {
    return normalizedPath;
  }

  const separator = normalizedPath.includes("?") ? "&" : "?";
  return `${normalizedPath}${separator}v=${encodeURIComponent(token)}`;
};

export const buildLocaleAlternatesForPath = (
  context: TenantRequestContext,
  path: string,
  locales: ReadonlyArray<LocaleTag>
): Record<string, string> | undefined => {
  return buildLocaleAlternates(context, normalizePath(path), locales);
};

export const buildOpenGraphLocales = (
  currentLocale: LocaleTag,
  locales: ReadonlyArray<LocaleTag>
) => {
  const ogLocale = toOpenGraphLocale(currentLocale);
  const alternateLocale = locales
    .filter((locale) => locale !== currentLocale)
    .map((locale) => toOpenGraphLocale(locale));

  return {
    ogLocale,
    alternateLocale: alternateLocale.length > 0 ? alternateLocale : undefined
  };
};

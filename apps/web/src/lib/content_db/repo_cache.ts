import { normalizeLocaleTag } from "../content/types";

export const CONTENT_REPO_CACHE_TTL_MS = 60_000;

type CacheEntry = {
  value: unknown;
  expiresAtMs: number;
  tenantId: string;
  testIds: string[];
};

type CacheWriteOptions<T> = {
  key: string;
  tenantId: string;
  testIds: string[];
  value: T;
};

type CreateContentRepoCacheOptions = {
  ttlMs?: number;
  now?: () => number;
};

export type ContentRepoCache = {
  read<T>(key: string): T | null;
  write<T>(options: CacheWriteOptions<T>): T;
  invalidateTenant(tenantId: string): void;
  invalidateTest(testId: string): void;
};

const normalizeToken = (value: string): string => value.trim().toLowerCase();

const normalizeLocaleToken = (locale: string): string => {
  const normalized = normalizeLocaleTag(locale);
  if (normalized) {
    return normalized.toLowerCase();
  }

  return normalizeToken(locale);
};

const normalizeTenantIndexKey = (tenantId: string): string => normalizeToken(tenantId);

const normalizeTestIndexKey = (testId: string): string => normalizeToken(testId);

export const buildTenantCatalogCacheKey = (tenantId: string): string =>
  `tenant_catalog:${normalizeToken(tenantId)}`;

export const buildPublishedTestCacheKey = (
  tenantId: string,
  slug: string,
  locale: string
): string => `published_test:${normalizeToken(tenantId)}:${normalizeToken(slug)}:${normalizeLocaleToken(locale)}`;

export const createContentRepoCache = (
  options: CreateContentRepoCacheOptions = {}
): ContentRepoCache => {
  const ttlMs = options.ttlMs ?? CONTENT_REPO_CACHE_TTL_MS;
  const now = options.now ?? Date.now;
  const entries = new Map<string, CacheEntry>();
  const tenantIndex = new Map<string, Set<string>>();
  const testIndex = new Map<string, Set<string>>();

  const addIndexKey = (index: Map<string, Set<string>>, indexKey: string, cacheKey: string): void => {
    if (!indexKey) {
      return;
    }

    const existing = index.get(indexKey);
    if (existing) {
      existing.add(cacheKey);
      return;
    }

    index.set(indexKey, new Set([cacheKey]));
  };

  const removeIndexKey = (index: Map<string, Set<string>>, indexKey: string, cacheKey: string): void => {
    const existing = index.get(indexKey);
    if (!existing) {
      return;
    }

    existing.delete(cacheKey);
    if (existing.size === 0) {
      index.delete(indexKey);
    }
  };

  const removeCacheKey = (cacheKey: string): void => {
    const entry = entries.get(cacheKey);
    if (!entry) {
      return;
    }

    entries.delete(cacheKey);
    removeIndexKey(tenantIndex, entry.tenantId, cacheKey);
    for (const testId of entry.testIds) {
      removeIndexKey(testIndex, testId, cacheKey);
    }
  };

  const read = <T>(key: string): T | null => {
    const entry = entries.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAtMs <= now()) {
      removeCacheKey(key);
      return null;
    }

    return entry.value as T;
  };

  const write = <T>(options: CacheWriteOptions<T>): T => {
    removeCacheKey(options.key);

    const normalizedTenantId = normalizeTenantIndexKey(options.tenantId);
    const normalizedTestIds = Array.from(
      new Set(options.testIds.map((testId) => normalizeTestIndexKey(testId)).filter(Boolean))
    );

    entries.set(options.key, {
      value: options.value,
      expiresAtMs: now() + ttlMs,
      tenantId: normalizedTenantId,
      testIds: normalizedTestIds
    });

    addIndexKey(tenantIndex, normalizedTenantId, options.key);
    for (const testId of normalizedTestIds) {
      addIndexKey(testIndex, testId, options.key);
    }

    return options.value;
  };

  const invalidateTenant = (tenantId: string): void => {
    const normalizedTenantId = normalizeTenantIndexKey(tenantId);
    if (!normalizedTenantId) {
      return;
    }

    const cacheKeys = tenantIndex.get(normalizedTenantId);
    if (!cacheKeys) {
      return;
    }

    for (const cacheKey of [...cacheKeys]) {
      removeCacheKey(cacheKey);
    }
  };

  const invalidateTest = (testId: string): void => {
    const normalizedTestId = normalizeTestIndexKey(testId);
    if (!normalizedTestId) {
      return;
    }

    const cacheKeys = testIndex.get(normalizedTestId);
    if (!cacheKeys) {
      return;
    }

    for (const cacheKey of [...cacheKeys]) {
      removeCacheKey(cacheKey);
    }
  };

  return {
    read,
    write,
    invalidateTenant,
    invalidateTest
  };
};

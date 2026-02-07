export const SITEMAP_CACHE_TTL_MS = 15 * 60 * 1000;

type CacheEntry = {
  value: unknown;
  expiresAtMs: number;
};

type CreateSitemapCacheOptions = {
  ttlMs?: number;
  now?: () => number;
};

export type SitemapCache = {
  read<T>(tenantId: string): T | null;
  write<T>(tenantId: string, value: T): T;
  invalidateTenant(tenantId: string): void;
};

const normalizeTenantId = (tenantId: string): string => tenantId.trim().toLowerCase();

export const createSitemapCache = (
  options: CreateSitemapCacheOptions = {}
): SitemapCache => {
  const ttlMs = options.ttlMs ?? SITEMAP_CACHE_TTL_MS;
  const now = options.now ?? Date.now;
  const entries = new Map<string, CacheEntry>();

  const read = <T>(tenantId: string): T | null => {
    const cacheKey = normalizeTenantId(tenantId);
    if (!cacheKey) {
      return null;
    }

    const entry = entries.get(cacheKey);
    if (!entry) {
      return null;
    }

    if (entry.expiresAtMs <= now()) {
      entries.delete(cacheKey);
      return null;
    }

    return entry.value as T;
  };

  const write = <T>(tenantId: string, value: T): T => {
    const cacheKey = normalizeTenantId(tenantId);
    if (!cacheKey) {
      return value;
    }

    entries.set(cacheKey, {
      value,
      expiresAtMs: now() + ttlMs
    });

    return value;
  };

  const invalidateTenant = (tenantId: string): void => {
    const cacheKey = normalizeTenantId(tenantId);
    if (!cacheKey) {
      return;
    }

    entries.delete(cacheKey);
  };

  return {
    read,
    write,
    invalidateTenant
  };
};

const sitemapCache = createSitemapCache({ ttlMs: SITEMAP_CACHE_TTL_MS });

export const readTenantSitemap = <T>(tenantId: string): T | null => {
  return sitemapCache.read<T>(tenantId);
};

export const writeTenantSitemap = <T>(tenantId: string, value: T): T => {
  return sitemapCache.write<T>(tenantId, value);
};

export const invalidateTenant = (tenantId: string): void => {
  sitemapCache.invalidateTenant(tenantId);
};

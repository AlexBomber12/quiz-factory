export const SITEMAP_CACHE_TTL_MS = 15 * 60 * 1000;

type CacheEntry = {
  value: unknown;
  tenantId: string;
  expiresAtMs: number;
};

type CreateSitemapCacheOptions = {
  ttlMs?: number;
  now?: () => number;
};

export type TenantSitemapCacheContext = {
  tenantId: string;
  host: string | null;
  requestHost: string | null;
  protocol: string;
};

export type SitemapCache = {
  read<T>(context: TenantSitemapCacheContext): T | null;
  write<T>(context: TenantSitemapCacheContext, value: T): T;
  invalidateTenant(tenantId: string): void;
};

const normalizeTenantId = (tenantId: string): string => tenantId.trim().toLowerCase();
const normalizeToken = (value: string): string => value.trim().toLowerCase();

const normalizeHostToken = (host: string | null): string => {
  if (!host) {
    return "-";
  }

  const trimmed = host.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : "-";
};

const buildCacheKey = (context: TenantSitemapCacheContext): string => {
  const tenantId = normalizeTenantId(context.tenantId);
  if (!tenantId) {
    return "";
  }

  const host = normalizeHostToken(context.host);
  const requestHost = normalizeHostToken(context.requestHost);
  const protocol = normalizeToken(context.protocol || "");
  return `${tenantId}:${host}:${requestHost}:${protocol}`;
};

export const createSitemapCache = (
  options: CreateSitemapCacheOptions = {}
): SitemapCache => {
  const ttlMs = options.ttlMs ?? SITEMAP_CACHE_TTL_MS;
  const now = options.now ?? Date.now;
  const entries = new Map<string, CacheEntry>();
  const tenantIndex = new Map<string, Set<string>>();

  const addIndexKey = (tenantId: string, cacheKey: string): void => {
    const existing = tenantIndex.get(tenantId);
    if (existing) {
      existing.add(cacheKey);
      return;
    }

    tenantIndex.set(tenantId, new Set([cacheKey]));
  };

  const removeIndexKey = (tenantId: string, cacheKey: string): void => {
    const existing = tenantIndex.get(tenantId);
    if (!existing) {
      return;
    }

    existing.delete(cacheKey);
    if (existing.size === 0) {
      tenantIndex.delete(tenantId);
    }
  };

  const removeCacheKey = (cacheKey: string): void => {
    const existing = entries.get(cacheKey);
    if (!existing) {
      return;
    }

    entries.delete(cacheKey);
    removeIndexKey(existing.tenantId, cacheKey);
  };

  const read = <T>(context: TenantSitemapCacheContext): T | null => {
    const cacheKey = buildCacheKey(context);
    if (!cacheKey) {
      return null;
    }

    const entry = entries.get(cacheKey);
    if (!entry) {
      return null;
    }

    if (entry.expiresAtMs <= now()) {
      removeCacheKey(cacheKey);
      return null;
    }

    return entry.value as T;
  };

  const write = <T>(context: TenantSitemapCacheContext, value: T): T => {
    const cacheKey = buildCacheKey(context);
    if (!cacheKey) {
      return value;
    }

    const tenantId = normalizeTenantId(context.tenantId);
    removeCacheKey(cacheKey);
    entries.set(cacheKey, {
      value,
      tenantId,
      expiresAtMs: now() + ttlMs
    });
    addIndexKey(tenantId, cacheKey);

    return value;
  };

  const invalidateTenant = (tenantId: string): void => {
    const normalizedTenantId = normalizeTenantId(tenantId);
    if (!normalizedTenantId) {
      return;
    }

    const keys = tenantIndex.get(normalizedTenantId);
    if (!keys) {
      return;
    }

    for (const cacheKey of [...keys]) {
      removeCacheKey(cacheKey);
    }
  };

  return {
    read,
    write,
    invalidateTenant
  };
};

const sitemapCache = createSitemapCache({ ttlMs: SITEMAP_CACHE_TTL_MS });

export const readTenantSitemap = <T>(context: TenantSitemapCacheContext): T | null => {
  return sitemapCache.read<T>(context);
};

export const writeTenantSitemap = <T>(context: TenantSitemapCacheContext, value: T): T => {
  return sitemapCache.write<T>(context, value);
};

export const invalidateTenant = (tenantId: string): void => {
  sitemapCache.invalidateTenant(tenantId);
};

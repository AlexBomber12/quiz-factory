import { getContentDbPool } from "../content_db/pool";
import { normalizeHostname } from "../security/request_host";
import { normalizeString } from "@/lib/utils/strings";

export const TENANT_RUNTIME_CACHE_TTL_MS = 60_000;
export const TENANT_DOMAIN_CACHE_MAX_ENTRIES = 1_024;

export type RuntimeTenantRecord = {
  tenantId: string;
  defaultLocale: string | null;
};

type TenantByDomainRow = {
  tenant_id: string | null;
  default_locale: string | null;
};

type DomainRow = {
  domain: string | null;
};

type TenantCacheEntry = {
  value: RuntimeTenantRecord | null;
  expiresAtMs: number;
};

type AllowedHostsCacheEntry = {
  value: Set<string>;
  expiresAtMs: number;
};

const tenantByDomainCache = new Map<string, TenantCacheEntry>();
let allowedHostsCache: AllowedHostsCacheEntry | null = null;


const normalizeDomain = (value: unknown): string | null => {
  return normalizeHostname(normalizeString(value));
};

const now = (): number => Date.now();

const pruneTenantByDomainCache = (currentNow: number): void => {
  for (const [domain, entry] of tenantByDomainCache) {
    if (entry.expiresAtMs <= currentNow) {
      tenantByDomainCache.delete(domain);
    }
  }

  while (tenantByDomainCache.size > TENANT_DOMAIN_CACHE_MAX_ENTRIES) {
    const oldestDomain = tenantByDomainCache.keys().next().value;
    if (!oldestDomain) {
      break;
    }

    tenantByDomainCache.delete(oldestDomain);
  }
};

const readTenantFromCache = (domain: string): RuntimeTenantRecord | null | undefined => {
  const cached = tenantByDomainCache.get(domain);
  if (!cached) {
    return undefined;
  }

  if (cached.expiresAtMs <= now()) {
    tenantByDomainCache.delete(domain);
    return undefined;
  }

  // Refresh access order so hot domains are less likely to be evicted.
  tenantByDomainCache.delete(domain);
  tenantByDomainCache.set(domain, cached);

  return cached.value;
};

const writeTenantToCache = (domain: string, value: RuntimeTenantRecord | null): RuntimeTenantRecord | null => {
  const currentNow = now();
  pruneTenantByDomainCache(currentNow);
  if (tenantByDomainCache.has(domain)) {
    tenantByDomainCache.delete(domain);
  }

  tenantByDomainCache.set(domain, {
    value,
    expiresAtMs: currentNow + TENANT_RUNTIME_CACHE_TTL_MS
  });
  pruneTenantByDomainCache(currentNow);

  return value;
};

const readAllowedHostsFromCache = (): Set<string> | null => {
  if (!allowedHostsCache) {
    return null;
  }

  if (allowedHostsCache.expiresAtMs <= now()) {
    allowedHostsCache = null;
    return null;
  }

  return new Set(allowedHostsCache.value);
};

const writeAllowedHostsToCache = (hosts: Set<string>): Set<string> => {
  allowedHostsCache = {
    value: new Set(hosts),
    expiresAtMs: now() + TENANT_RUNTIME_CACHE_TTL_MS
  };

  return new Set(hosts);
};

export const resolveTenantByDomainFromDb = async (
  domainInput: string
): Promise<RuntimeTenantRecord | null> => {
  const domain = normalizeDomain(domainInput);
  if (!domain) {
    return null;
  }

  const cached = readTenantFromCache(domain);
  if (cached !== undefined) {
    return cached;
  }

  const pool = getContentDbPool();
  const result = await pool.query<TenantByDomainRow>(
    `
      SELECT
        t.tenant_id,
        t.default_locale
      FROM tenant_domains td
      JOIN tenants t
        ON t.tenant_id = td.tenant_id
      WHERE td.domain = $1
        AND t.enabled = TRUE
      LIMIT 1
    `,
    [domain]
  );

  const row = result.rows[0];
  const tenantId = normalizeString(row?.tenant_id);
  if (!tenantId) {
    return writeTenantToCache(domain, null);
  }

  const resolved = {
    tenantId,
    defaultLocale: normalizeString(row?.default_locale)
  };

  return writeTenantToCache(domain, resolved);
};

export const listAllowedHostsFromDb = async (): Promise<Set<string>> => {
  const cached = readAllowedHostsFromCache();
  if (cached) {
    return cached;
  }

  const pool = getContentDbPool();
  const result = await pool.query<DomainRow>(
    `
      SELECT td.domain
      FROM tenant_domains td
      JOIN tenants t
        ON t.tenant_id = td.tenant_id
      WHERE t.enabled = TRUE
      ORDER BY td.domain ASC
    `
  );

  const hosts = new Set<string>();
  for (const row of result.rows) {
    const normalized = normalizeDomain(row.domain);
    if (normalized) {
      hosts.add(normalized);
    }
  }

  return writeAllowedHostsToCache(hosts);
};

export const invalidateTenantRuntimeCache = (): void => {
  tenantByDomainCache.clear();
  allowedHostsCache = null;
};

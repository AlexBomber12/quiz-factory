import tenantsConfig from "../../../../../config/tenants.json";

import { normalizeString } from "../analytics/session";
import { normalizeHostname, resolveEffectiveHost } from "../security/request_host";

type TenantConfig = {
  tenant_id: string;
  domains: string[];
  default_locale: string;
};

type TenantRegistry = {
  tenants: TenantConfig[];
};

type TenantResolution = {
  tenantId: string;
  defaultLocale: string | null;
};

const DEFAULT_LOCALE = "en";

const slugify = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-");
};

const buildFallbackTenantId = (host: string | null): string => {
  const slug = host ? slugify(host) : "";
  return slug ? `tenant-${slug}` : "tenant-unknown";
};

const tenantRegistry = (tenantsConfig as TenantRegistry).tenants ?? [];
const tenantByDomain = new Map<string, TenantConfig>();

for (const tenant of tenantRegistry) {
  for (const domain of tenant.domains ?? []) {
    const normalized = normalizeHostname(domain);
    if (normalized) {
      tenantByDomain.set(normalized, tenant);
    }
  }
}

const normalizeLocaleTag = (raw: string | null): string | null => {
  const trimmed = normalizeString(raw);
  if (!trimmed) {
    return null;
  }

  const parts = trimmed.split("-");
  if (parts.length > 2) {
    return null;
  }

  const [languagePart, regionPart] = parts;
  if (!languagePart || !/^[a-zA-Z]{2,3}$/.test(languagePart)) {
    return null;
  }

  const language = languagePart.toLowerCase();
  if (!regionPart) {
    return language;
  }

  if (!/^[a-zA-Z]{2,3}$/.test(regionPart)) {
    return language;
  }

  return `${language}-${regionPart.toUpperCase()}`;
};

export const parseAcceptLanguage = (header: string | null): string => {
  const normalized = normalizeString(header);
  if (!normalized) {
    return DEFAULT_LOCALE;
  }

  const [firstTag] = normalized.split(",");
  const [tag] = (firstTag ?? "").split(";");
  const parsed = normalizeLocaleTag(tag);
  return parsed ?? DEFAULT_LOCALE;
};

export const resolveLocale = (options: {
  defaultLocale?: string | null;
  acceptLanguage?: string | null;
}): string => {
  const tenantLocale = normalizeLocaleTag(options.defaultLocale ?? null);
  if (tenantLocale) {
    return tenantLocale;
  }

  return parseAcceptLanguage(options.acceptLanguage ?? null);
};

export const resolveTenant = (
  headers: Headers,
  fallbackHost?: string | null
): TenantResolution => {
  const host = resolveEffectiveHost(headers, fallbackHost);

  if (!host) {
    return { tenantId: buildFallbackTenantId(null), defaultLocale: null };
  }

  const tenant = tenantByDomain.get(host);
  if (tenant) {
    return {
      tenantId: tenant.tenant_id,
      defaultLocale: normalizeLocaleTag(tenant.default_locale)
    };
  }

  return { tenantId: buildFallbackTenantId(host), defaultLocale: null };
};

import { headers } from "next/headers";

import { normalizeLocaleTag, LocaleTag } from "../content/types";
import { resolveLocale, resolveTenantAsync } from "./resolve";

type HeaderLike = {
  get(name: string): string | null;
};

export type TenantRequestContext = {
  tenantId: string;
  locale: LocaleTag;
  host: string | null;
  requestHost: string | null;
  protocol: string;
};

const HOST_PORT_PATTERN = /:\d+$/;
const FALLBACK_PROTOCOL = "https";
const FALLBACK_LOCALE: LocaleTag = "en";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

const normalizeHost = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const [firstHost] = value.split(",");
  const host = firstHost?.trim();
  if (!host) {
    return null;
  }

  return host.replace(HOST_PORT_PATTERN, "").toLowerCase();
};

const normalizeRequestHost = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const [firstHost] = value.split(",");
  const host = firstHost?.trim();
  if (!host) {
    return null;
  }

  return host.toLowerCase();
};

const stripIpv6Brackets = (value: string): string => {
  return value.replace(/^\[|\]$/g, "");
};

const isLocalHost = (host: string | null): boolean => {
  if (!host) {
    return false;
  }

  const normalized = stripIpv6Brackets(host);
  return LOCAL_HOSTS.has(normalized);
};

const resolveRequestHost = (headerStore: HeaderLike): string | null => {
  return (
    normalizeHost(headerStore.get("x-forwarded-host")) ??
    normalizeHost(headerStore.get("host"))
  );
};

const resolveRequestHostHeader = (headerStore: HeaderLike): string | null => {
  return (
    normalizeRequestHost(headerStore.get("x-forwarded-host")) ??
    normalizeRequestHost(headerStore.get("host"))
  );
};

const resolveRequestProtocol = (
  headerStore: HeaderLike,
  requestHost: string | null
): string => {
  const forwarded = headerStore.get("x-forwarded-proto");
  if (!forwarded) {
    if (isLocalHost(normalizeHost(requestHost))) {
      return "http";
    }
    return FALLBACK_PROTOCOL;
  }

  const [firstProtocol] = forwarded.split(",");
  const protocol = firstProtocol?.trim().toLowerCase();
  if (protocol === "http" || protocol === "https") {
    return protocol;
  }

  return FALLBACK_PROTOCOL;
};

export const resolveTenantContext = async (): Promise<TenantRequestContext> => {
  const headerStore = await headers();
  const tenantResolution = await resolveTenantAsync(new Headers(headerStore));
  const locale = resolveLocale({
    defaultLocale: tenantResolution.defaultLocale,
    acceptLanguage: headerStore.get("accept-language")
  });
  const normalizedLocale = normalizeLocaleTag(locale) ?? FALLBACK_LOCALE;
  const requestHost = resolveRequestHostHeader(headerStore);

  return {
    tenantId: tenantResolution.tenantId,
    locale: normalizedLocale,
    host: resolveRequestHost(headerStore),
    requestHost,
    protocol: resolveRequestProtocol(headerStore, requestHost)
  };
};

export const buildCanonicalUrl = (
  context: Pick<TenantRequestContext, "host" | "protocol" | "requestHost">,
  path: string
): string | null => {
  const requestHost = context.requestHost ?? null;
  const normalizedHost = normalizeHost(requestHost ?? context.host);
  const useRequestHost = requestHost && isLocalHost(normalizedHost);
  const canonicalHost = useRequestHost ? requestHost : context.host;

  if (!canonicalHost) {
    return null;
  }

  const protocol =
    process.env.NODE_ENV === "production" ? "https" : context.protocol;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${protocol}://${canonicalHost}${normalizedPath}`;
};

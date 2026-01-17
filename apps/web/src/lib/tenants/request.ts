import { headers } from "next/headers";

import { normalizeLocaleTag, LocaleTag } from "../content/types";
import { resolveLocale, resolveTenant } from "./resolve";

type HeaderLike = {
  get(name: string): string | null;
};

export type TenantRequestContext = {
  tenantId: string;
  locale: LocaleTag;
  host: string | null;
  protocol: string;
};

const HOST_PORT_PATTERN = /:\d+$/;
const FALLBACK_PROTOCOL = "https";
const FALLBACK_LOCALE: LocaleTag = "en";

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

const resolveRequestHost = (headerStore: HeaderLike): string | null => {
  return (
    normalizeHost(headerStore.get("x-forwarded-host")) ??
    normalizeHost(headerStore.get("host"))
  );
};

const resolveRequestProtocol = (headerStore: HeaderLike): string => {
  const forwarded = headerStore.get("x-forwarded-proto");
  if (!forwarded) {
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
  const tenantResolution = resolveTenant(new Headers(headerStore));
  const locale = resolveLocale({
    defaultLocale: tenantResolution.defaultLocale,
    acceptLanguage: headerStore.get("accept-language")
  });
  const normalizedLocale = normalizeLocaleTag(locale) ?? FALLBACK_LOCALE;

  return {
    tenantId: tenantResolution.tenantId,
    locale: normalizedLocale,
    host: resolveRequestHost(headerStore),
    protocol: resolveRequestProtocol(headerStore)
  };
};

export const buildCanonicalUrl = (
  context: Pick<TenantRequestContext, "host" | "protocol">,
  path: string
): string | null => {
  if (!context.host) {
    return null;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${context.protocol}://${context.host}${normalizedPath}`;
};

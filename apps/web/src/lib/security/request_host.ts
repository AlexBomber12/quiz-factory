import { normalizeStringStrict, parseBoolean } from "@/lib/utils/strings";

type HeaderLike = Pick<Headers, "get">;

const HOST_PORT_PATTERN = /:\d+$/;



const takeFirstHost = (value: string | null | undefined): string | null => {
  const trimmed = normalizeStringStrict(value);
  if (!trimmed) {
    return null;
  }

  const [firstHost] = trimmed.split(",");
  const host = firstHost?.trim();
  return host ? host : null;
};

const shouldTrustForwardedHost = (): boolean => {
  return parseBoolean(process.env.TRUST_X_FORWARDED_HOST) ?? false;
};

export const normalizeHostname = (value: string | null | undefined): string | null => {
  const host = takeFirstHost(value);
  if (!host) {
    return null;
  }

  if (host.startsWith("[")) {
    const closingBracket = host.indexOf("]");
    if (closingBracket > 0) {
      const ipv6 = host.slice(1, closingBracket).trim();
      return ipv6.length > 0 ? ipv6.toLowerCase() : null;
    }
  }

  const colonMatches = host.match(/:/g);
  if (colonMatches && colonMatches.length > 1) {
    return host.toLowerCase();
  }

  return host.replace(HOST_PORT_PATTERN, "").toLowerCase();
};

export const resolveEffectiveHost = (
  headers: HeaderLike,
  fallbackHost?: string | null
): string | null => {
  if (shouldTrustForwardedHost()) {
    const forwardedHost = normalizeHostname(headers.get("x-forwarded-host"));
    if (forwardedHost) {
      return forwardedHost;
    }
  }

  return normalizeHostname(headers.get("host")) ?? normalizeHostname(fallbackHost);
};

export const resolveEffectiveRequestHost = (request: Request): string => {
  let fallbackHost: string | null = null;
  try {
    fallbackHost = new URL(request.url).host;
  } catch {
    fallbackHost = null;
  }

  return resolveEffectiveHost(request.headers, fallbackHost) ?? "";
};

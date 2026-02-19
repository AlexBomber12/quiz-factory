import { normalizeStringStrict } from "@/lib/utils/strings";

export type PublicBaseParts = { origin: string; protocol: string; host: string };

const DEFAULT_PROTOCOL = "https";
const DEFAULT_HOST = "localhost";


const takeFirst = (value: string | null | undefined): string | null => {
  const normalized = normalizeStringStrict(value);
  if (!normalized) {
    return null;
  }

  const [first] = normalized.split(",");
  const trimmed = first?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
};

const normalizeProtocol = (value: string | null | undefined): "http" | "https" | null => {
  const normalized = normalizeStringStrict(value)?.toLowerCase().replace(/:$/, "");
  if (normalized === "http" || normalized === "https") {
    return normalized;
  }
  return null;
};

const isUnspecifiedHost = (host: string): boolean => {
  const normalized = host.trim().toLowerCase();
  return (
    normalized === "0.0.0.0" ||
    normalized === "::" ||
    normalized === "[::]" ||
    normalized.startsWith("0.0.0.0:") ||
    normalized.startsWith("[::]:")
  );
};

const parseRequestUrl = (request: Request): URL | null => {
  try {
    return new URL(request.url);
  } catch {
    return null;
  }
};

export const resolvePublicBase = (request: Request): PublicBaseParts => {
  const forwardedProto = normalizeProtocol(takeFirst(request.headers.get("x-forwarded-proto")));
  const forwardedHost = takeFirst(request.headers.get("x-forwarded-host"));
  const hostHeader = takeFirst(request.headers.get("host"));

  const requestUrl = parseRequestUrl(request);
  const requestHost = normalizeStringStrict(requestUrl?.host);
  const requestProto = normalizeProtocol(requestUrl?.protocol);

  let host = forwardedHost ?? hostHeader ?? requestHost ?? DEFAULT_HOST;
  if (isUnspecifiedHost(host) && forwardedHost) {
    host = forwardedHost;
  }

  const protocol = forwardedProto ?? requestProto ?? DEFAULT_PROTOCOL;
  const origin = `${protocol}://${host}`;

  return {
    origin,
    protocol,
    host
  };
};

export const buildRedirectUrl = (request: Request, pathname: string): URL => {
  const base = resolvePublicBase(request).origin;
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return new URL(normalizedPath, base);
};

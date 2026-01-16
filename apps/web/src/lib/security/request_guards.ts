import { createHash } from "crypto";
import { NextResponse } from "next/server";

import tenantsConfig from "../../../../../config/tenants.json";

import { DISTINCT_COOKIE_NAME } from "../analytics/constants";
import { parseCookies } from "../analytics/session";

type TenantConfig = {
  tenant_id: string;
  domains: string[];
  default_locale: string;
};

type TenantRegistry = {
  tenants: TenantConfig[];
};

export type RateLimitOptions = {
  windowSeconds: number;
  maxRequests: number;
  enabled?: boolean;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const HOST_PORT_PATTERN = /:\d+$/;
const ALLOWED_METHOD_FALLBACK = "OPTIONS";
const DEV_RATE_LIMIT_SALT = "dev-rate-limit-salt";

export const DEFAULT_EVENT_BODY_BYTES = 32 * 1024;
export const DEFAULT_EVENT_RATE_LIMIT: RateLimitOptions = {
  windowSeconds: 60,
  maxRequests: 60
};

const normalizeString = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeHost = (value: string | null | undefined): string | null => {
  const trimmed = normalizeString(value);
  if (!trimmed) {
    return null;
  }

  const [firstHost] = trimmed.split(",");
  const host = firstHost?.trim();
  if (!host) {
    return null;
  }

  return host.replace(HOST_PORT_PATTERN, "").toLowerCase();
};

const tenantRegistry = (tenantsConfig as TenantRegistry).tenants ?? [];
const allowedHosts = new Set<string>();

for (const tenant of tenantRegistry) {
  for (const domain of tenant.domains ?? []) {
    const normalized = normalizeHost(domain);
    if (normalized) {
      allowedHosts.add(normalized);
    }
  }
}

const parseBoolean = (value: string | undefined): boolean | undefined => {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return undefined;
};

const parsePositiveInt = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
};

const parseForwardedFor = (value: string | null): string | null => {
  const trimmed = normalizeString(value);
  if (!trimmed) {
    return null;
  }

  const [firstIp] = trimmed.split(",");
  const candidate = firstIp?.trim();
  return candidate ? candidate : null;
};

const rateLimitState = new Map<string, RateLimitEntry>();

const resolveRateLimitConfig = (
  options: RateLimitOptions
): { enabled: boolean; windowSeconds: number; maxRequests: number } => {
  const envEnabled = parseBoolean(process.env.RATE_LIMIT_ENABLED);
  const enabled = envEnabled ?? options.enabled ?? true;

  const envWindowSeconds = parsePositiveInt(process.env.RATE_LIMIT_WINDOW_SECONDS);
  const windowSeconds = envWindowSeconds ?? options.windowSeconds;

  const envMaxRequests = parsePositiveInt(process.env.RATE_LIMIT_MAX_REQUESTS);
  const maxRequests = envMaxRequests ?? options.maxRequests;

  return { enabled, windowSeconds, maxRequests };
};

const resolveRateLimitKey = (
  request: Request
): { key: string | null; error: Response | null } => {
  const cookies = parseCookies(request.headers.get("cookie"));
  const distinctId = normalizeString(cookies[DISTINCT_COOKIE_NAME]);
  if (distinctId) {
    return { key: `distinct:${distinctId}`, error: null };
  }

  const forwardedFor = parseForwardedFor(request.headers.get("x-forwarded-for"));
  if (!forwardedFor) {
    return { key: "ip:unknown", error: null };
  }

  let salt = process.env.RATE_LIMIT_SALT;
  if (!salt) {
    if (process.env.NODE_ENV === "production") {
      return {
        key: null,
        error: NextResponse.json(
          { error: "Rate limiting is not configured." },
          { status: 500 }
        )
      };
    }
    salt = DEV_RATE_LIMIT_SALT;
  }

  const hashed = createHash("sha256")
    .update(`${forwardedFor}${salt}`)
    .digest("hex");
  return { key: `ip:${hashed}`, error: null };
};

const buildForbiddenResponse = (message: string): Response => {
  return NextResponse.json({ error: message }, { status: 403 });
};

export const resetRateLimitState = (): void => {
  rateLimitState.clear();
};

const shouldTrustForwardedHost = (): boolean => {
  return parseBoolean(process.env.TRUST_X_FORWARDED_HOST) ?? false;
};

export const resolveRequestHost = (request: Request): string => {
  if (shouldTrustForwardedHost()) {
    const forwardedHost = normalizeHost(request.headers.get("x-forwarded-host"));
    if (forwardedHost) {
      return forwardedHost;
    }
  }

  const host = normalizeHost(request.headers.get("host"));
  if (host) {
    return host;
  }

  try {
    return new URL(request.url).hostname.toLowerCase();
  } catch {
    return "";
  }
};

export const assertAllowedHost = (request: Request): Response | null => {
  const host = resolveRequestHost(request);
  if (!host || !allowedHosts.has(host)) {
    return buildForbiddenResponse("Host is not allowed.");
  }

  return null;
};

export const assertAllowedOrigin = (request: Request): Response | null => {
  const originHeader = request.headers.get("origin");
  if (!originHeader) {
    return null;
  }

  let originUrl: URL | null = null;
  try {
    originUrl = new URL(originHeader);
  } catch {
    originUrl = null;
  }

  if (!originUrl) {
    return buildForbiddenResponse("Origin is not allowed.");
  }

  const protocol = originUrl.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    return buildForbiddenResponse("Origin is not allowed.");
  }

  const originHost = normalizeHost(originUrl.host);
  if (!originHost || !allowedHosts.has(originHost)) {
    return buildForbiddenResponse("Origin is not allowed.");
  }

  return null;
};

export const assertAllowedMethod = (
  request: Request,
  allowedMethods: string[]
): Response | null => {
  const normalizedAllowed = allowedMethods.map((method) => method.toUpperCase());
  const method = request.method.toUpperCase();
  if (!normalizedAllowed.includes(method)) {
    return NextResponse.json(
      { error: "Method is not allowed." },
      {
        status: 405,
        headers: {
          Allow: normalizedAllowed.join(", ") || ALLOWED_METHOD_FALLBACK
        }
      }
    );
  }

  return null;
};

export const assertMaxBodyBytes = async (
  request: Request,
  maxBytes: number
): Promise<Response | null> => {
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
    return null;
  }

  const contentLengthHeader = request.headers.get("content-length");
  const contentLength = contentLengthHeader
    ? Number.parseInt(contentLengthHeader, 10)
    : Number.NaN;

  if (Number.isFinite(contentLength)) {
    if (contentLength > maxBytes) {
      return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
    }
    return null;
  }

  try {
    const buffer = await request.clone().arrayBuffer();
    if (buffer.byteLength > maxBytes) {
      return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  return null;
};

export const rateLimit = (request: Request, options: RateLimitOptions): Response | null => {
  const config = resolveRateLimitConfig(options);
  if (!config.enabled) {
    return null;
  }

  const { key, error } = resolveRateLimitKey(request);
  if (error) {
    return error;
  }
  if (!key) {
    return null;
  }

  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const entry = rateLimitState.get(key);

  if (!entry || now >= entry.resetAt) {
    rateLimitState.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (entry.count >= config.maxRequests) {
    const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    return NextResponse.json(
      { error: "Rate limit exceeded." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  entry.count += 1;
  return null;
};

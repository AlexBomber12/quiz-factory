import { env } from "@/lib/env";
import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

import tenantsConfig from "../../../../../config/tenants.json";

import { DISTINCT_COOKIE_NAME } from "../analytics/constants";
import { parseCookies } from "../analytics/session";
import { listAllowedHostsFromDb } from "../tenants/runtime_db";
import { getTenantsSource } from "../tenants/source";
import { normalizeHostname, resolveEffectiveRequestHost } from "./request_host";
import { normalizeStringStrict, parsePositiveInt, parseBoolean } from "@/lib/utils/strings";

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

type AllowlistMode = "prod" | "dev";

const ALLOWED_METHOD_FALLBACK = "OPTIONS";
const DEV_RATE_LIMIT_SALT = "dev-rate-limit-salt";
const DEV_LOCALHOST_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export const DEFAULT_EVENT_BODY_BYTES = 32 * 1024;
export const DEFAULT_EVENT_RATE_LIMIT: RateLimitOptions = {
  windowSeconds: 60,
  maxRequests: 60
};

const normalizeOrigin = (originHeader: string | null | undefined): string | null => {
  const trimmed = normalizeStringStrict(originHeader);
  if (!trimmed) {
    return null;
  }

  let originUrl: URL | null = null;
  try {
    originUrl = new URL(trimmed);
  } catch (error) {
    logger.error({ error }, "lib/security/request_guards.ts operation failed");
    originUrl = null;
  }

  if (!originUrl) {
    return null;
  }

  const protocol = originUrl.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    return null;
  }

  return normalizeHostname(originUrl.host);
};

export const getAllowlistMode = (): AllowlistMode => {
  return process.env.NODE_ENV === "production" ? "prod" : "dev";
};

const tenantRegistry = (tenantsConfig as TenantRegistry).tenants ?? [];
const fileAllowedHosts = new Set<string>();

for (const tenant of tenantRegistry) {
  for (const domain of tenant.domains ?? []) {
    const normalized = normalizeHostname(domain);
    if (normalized) {
      fileAllowedHosts.add(normalized);
    }
  }
}

const getExtraAllowedHosts = (): Set<string> => {
  const extraHosts = new Set<string>();
  const raw = env.EXTRA_ALLOWED_HOSTS;
  if (!raw) {
    return extraHosts;
  }

  for (const entry of raw.split(",")) {
    const normalized = normalizeHostname(entry);
    if (normalized) {
      extraHosts.add(normalized);
    }
  }

  return extraHosts;
};

const isAllowedHost = (host: string | null): boolean => {
  if (!host) {
    return false;
  }

  if (getTenantsSource() !== "file") {
    return false;
  }

  if (fileAllowedHosts.has(host)) {
    return true;
  }

  if (getAllowlistMode() !== "dev") {
    return false;
  }

  if (DEV_LOCALHOST_HOSTS.has(host)) {
    return true;
  }

  return getExtraAllowedHosts().has(host);
};

const isAllowedOrigin = (originHeader: string | null | undefined): boolean => {
  const originHost = normalizeOrigin(originHeader);
  if (!originHost) {
    return false;
  }

  return isAllowedHost(originHost);
};

const isAllowedHostAsync = async (host: string | null): Promise<boolean> => {
  if (!host) {
    return false;
  }

  if (getTenantsSource() === "db") {
    try {
      const dbAllowedHosts = await listAllowedHostsFromDb();
      if (dbAllowedHosts.has(host)) {
        return true;
      }
    } catch (error) {
      logger.error({ error }, "lib/security/request_guards.ts operation failed");
      return false;
    }

    if (getAllowlistMode() !== "dev") {
      return false;
    }

    if (DEV_LOCALHOST_HOSTS.has(host)) {
      return true;
    }

    return getExtraAllowedHosts().has(host);
  }

  return isAllowedHost(host);
};

const isAllowedOriginAsync = async (
  originHeader: string | null | undefined
): Promise<boolean> => {
  const originHost = normalizeOrigin(originHeader);
  if (!originHost) {
    return false;
  }

  return isAllowedHostAsync(originHost);
};



const parseForwardedFor = (value: string | null): string | null => {
  const trimmed = normalizeStringStrict(value);
  if (!trimmed) {
    return null;
  }

  const [firstIp] = trimmed.split(",");
  const candidate = firstIp?.trim();
  return candidate ? candidate : null;
};

const rateLimitState = new Map<string, RateLimitEntry>();
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 60 * 1000;
let lastRateLimitCleanup = 0;

const cleanupRateLimitState = (now: number): void => {
  if (now - lastRateLimitCleanup < RATE_LIMIT_CLEANUP_INTERVAL_MS) {
    return;
  }

  lastRateLimitCleanup = now;
  for (const [key, entry] of rateLimitState) {
    if (entry.resetAt <= now) {
      rateLimitState.delete(key);
    }
  }
};

const resolveRateLimitConfig = (
  options: RateLimitOptions
): { enabled: boolean; windowSeconds: number; maxRequests: number } => {
  const envEnabled = parseBoolean(env.RATE_LIMIT_ENABLED);
  const enabled = envEnabled ?? options.enabled ?? true;

  const envWindowSeconds = parsePositiveInt(env.RATE_LIMIT_WINDOW_SECONDS);
  const windowSeconds = envWindowSeconds ?? options.windowSeconds;

  const envMaxRequests = parsePositiveInt(env.RATE_LIMIT_MAX_REQUESTS);
  const maxRequests = envMaxRequests ?? options.maxRequests;

  return { enabled, windowSeconds, maxRequests };
};

const resolveRateLimitKey = (
  request: Request
): { key: string | null; error: Response | null } => {
  const cookies = parseCookies(request.headers.get("cookie"));
  const distinctId = normalizeStringStrict(cookies[DISTINCT_COOKIE_NAME]);
  if (distinctId) {
    return { key: `distinct:${distinctId}`, error: null };
  }

  const forwardedFor = parseForwardedFor(request.headers.get("x-forwarded-for"));
  if (!forwardedFor) {
    return { key: "ip:unknown", error: null };
  }

  let salt = env.RATE_LIMIT_SALT;
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

export const resolveRequestHost = (request: Request): string => {
  return resolveEffectiveRequestHost(request);
};

export const assertAllowedHost = (request: Request): Response | null => {
  const host = resolveRequestHost(request);
  if (!isAllowedHost(host)) {
    return buildForbiddenResponse("Host is not allowed.");
  }

  return null;
};

export const assertAllowedOrigin = (request: Request): Response | null => {
  const originHeader = request.headers.get("origin");
  if (!originHeader) {
    if (getAllowlistMode() === "dev") {
      return null;
    }
    return buildForbiddenResponse("Origin is not allowed.");
  }

  if (!isAllowedOrigin(originHeader)) {
    return buildForbiddenResponse("Origin is not allowed.");
  }

  return null;
};

export const assertAllowedHostAsync = async (
  request: Request
): Promise<Response | null> => {
  const host = resolveRequestHost(request);
  if (!(await isAllowedHostAsync(host))) {
    return buildForbiddenResponse("Host is not allowed.");
  }

  return null;
};

export const assertAllowedOriginAsync = async (
  request: Request
): Promise<Response | null> => {
  const originHeader = request.headers.get("origin");
  if (!originHeader) {
    if (getAllowlistMode() === "dev") {
      return null;
    }
    return buildForbiddenResponse("Origin is not allowed.");
  }

  if (!(await isAllowedOriginAsync(originHeader))) {
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
  } catch (error) {
    logger.error({ error }, "lib/security/request_guards.ts operation failed");
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
  cleanupRateLimitState(now);
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

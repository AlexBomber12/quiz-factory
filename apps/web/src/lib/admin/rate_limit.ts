import { normalizeStringStrict } from "@/lib/utils/strings";

type AdminRateLimitEntry = {
  count: number;
  resetAt: number;
};

export type AdminRateLimitOptions = {
  windowSeconds: number;
  maxRequests: number;
};

export type AdminRateLimitResult = {
  limited: boolean;
  retryAfterSeconds: number | null;
};

const state = new Map<string, AdminRateLimitEntry>();
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanupAt = 0;

export const ADMIN_UPLOAD_RATE_LIMIT: AdminRateLimitOptions = {
  windowSeconds: 60,
  maxRequests: 10
};

export const ADMIN_PUBLISH_RATE_LIMIT: AdminRateLimitOptions = {
  windowSeconds: 60,
  maxRequests: 20
};


const cleanup = (now: number): void => {
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) {
    return;
  }

  lastCleanupAt = now;
  for (const [key, entry] of state.entries()) {
    if (entry.resetAt <= now) {
      state.delete(key);
    }
  }
};

const resolveClientKey = (request: Request): string => {
  const forwarded = normalizeStringStrict(request.headers.get("x-forwarded-for"));
  if (forwarded) {
    const [firstIp] = forwarded.split(",");
    const candidate = normalizeStringStrict(firstIp);
    if (candidate) {
      return `ip:${candidate}`;
    }
  }

  const realIp = normalizeStringStrict(request.headers.get("x-real-ip"));
  if (realIp) {
    return `ip:${realIp}`;
  }

  return "ip:unknown";
};

export const consumeAdminRateLimit = (
  request: Request,
  scope: string,
  options: AdminRateLimitOptions
): AdminRateLimitResult => {
  const now = Date.now();
  cleanup(now);

  const windowMs = Math.max(1, Math.floor(options.windowSeconds)) * 1000;
  const maxRequests = Math.max(1, Math.floor(options.maxRequests));
  const key = `${scope}:${resolveClientKey(request)}`;
  const entry = state.get(key);

  if (!entry || now >= entry.resetAt) {
    state.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false, retryAfterSeconds: null };
  }

  if (entry.count >= maxRequests) {
    return {
      limited: true,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
    };
  }

  entry.count += 1;
  return { limited: false, retryAfterSeconds: null };
};

export const resetAdminRateLimitState = (): void => {
  state.clear();
  lastCleanupAt = 0;
};

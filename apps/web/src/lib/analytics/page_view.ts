import { env } from "@/lib/env";
import { createHash } from "crypto";
import { logger } from "@/lib/logger";

import { normalizeString } from "./session";

const PAGE_VIEW_DEDUP_TTL_MS = 24 * 60 * 60 * 1000;
const DEDUP_CLEANUP_INTERVAL_MS = 60 * 1000;
const PAGE_VIEW_EXTRA_SAMPLE_RATE_DEFAULT = 0.1;
const PAGE_URL_MAX_LENGTH = 256;

export const DEFAULT_PAGE_VIEW_TYPE = "attempt_entry";

const pageViewDedupState = new Map<string, number>();
let lastCleanupAt = 0;

const cleanupDedupState = (now: number): void => {
  if (now - lastCleanupAt < DEDUP_CLEANUP_INTERVAL_MS) {
    return;
  }

  lastCleanupAt = now;
  for (const [sessionId, expiresAt] of pageViewDedupState) {
    if (expiresAt <= now) {
      pageViewDedupState.delete(sessionId);
    }
  }
};

const resolveSampleRate = (value: string | undefined): number => {
  if (!value) {
    return PAGE_VIEW_EXTRA_SAMPLE_RATE_DEFAULT;
  }

  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return PAGE_VIEW_EXTRA_SAMPLE_RATE_DEFAULT;
  }

  return Math.min(Math.max(parsed, 0), 1);
};

const hashToUnitInterval = (input: string): number => {
  const digest = createHash("sha256").update(input).digest();
  const value = digest.readUInt32BE(0);
  return value / 0x100000000;
};

const stripQueryAndFragment = (input: string): string => {
  return input.split("?")[0]?.split("#")[0] ?? input;
};

export const resolvePageType = (value: unknown): string => {
  const normalized = normalizeString(value);
  if (!normalized || normalized === "attempt") {
    return DEFAULT_PAGE_VIEW_TYPE;
  }

  return normalized;
};

export const resolvePageViewSampleRate = (pageType: string): number => {
  if (pageType === DEFAULT_PAGE_VIEW_TYPE) {
    return 1;
  }

  return resolveSampleRate(env.PAGE_VIEW_SAMPLE_RATE);
};

export const shouldEmitPageView = (options: {
  sessionId: string;
  pageType: string;
  now?: number;
}): boolean => {
  const now = options.now ?? Date.now();
  cleanupDedupState(now);

  if (options.pageType === DEFAULT_PAGE_VIEW_TYPE) {
    const expiresAt = pageViewDedupState.get(options.sessionId);
    if (expiresAt && expiresAt > now) {
      return false;
    }

    pageViewDedupState.set(options.sessionId, now + PAGE_VIEW_DEDUP_TTL_MS);
    return true;
  }

  const sampleRate = resolvePageViewSampleRate(options.pageType);
  if (sampleRate <= 0) {
    return false;
  }
  if (sampleRate >= 1) {
    return true;
  }

  return hashToUnitInterval(options.sessionId) < sampleRate;
};

export const sanitizePageUrl = (value: unknown): string | null => {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }

  const trimmed = stripQueryAndFragment(normalized);
  let pathname = trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      pathname = new URL(trimmed).pathname;
    } catch (error) {
      logger.warn({ error }, "lib/analytics/page_view.ts fallback handling failed");
      pathname = trimmed;
    }
  } else if (trimmed.startsWith("//")) {
    try {
      pathname = new URL(`https:${trimmed}`).pathname;
    } catch (error) {
      logger.warn({ error }, "lib/analytics/page_view.ts fallback handling failed");
      pathname = trimmed;
    }
  } else if (trimmed.startsWith("/")) {
    try {
      pathname = new URL(trimmed, "https://placeholder.invalid").pathname;
    } catch (error) {
      logger.warn({ error }, "lib/analytics/page_view.ts fallback handling failed");
      pathname = trimmed;
    }
  } else if (trimmed.includes(".")) {
    try {
      pathname = new URL(`https://${trimmed}`).pathname;
    } catch (error) {
      logger.warn({ error }, "lib/analytics/page_view.ts fallback handling failed");
      pathname = trimmed;
    }
  }

  pathname = stripQueryAndFragment(pathname);
  if (!pathname) {
    return null;
  }

  if (!pathname.startsWith("/")) {
    pathname = `/${pathname}`;
  }

  if (pathname.length > PAGE_URL_MAX_LENGTH) {
    pathname = pathname.slice(0, PAGE_URL_MAX_LENGTH);
  }

  return pathname;
};

export const resetPageViewDedupCache = (): void => {
  pageViewDedupState.clear();
};

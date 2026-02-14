import { NextResponse } from "next/server";

import { executeProviderCall, parseFiltersFromRequest } from "../shared";
import type { AdminAnalyticsOverviewResponse } from "../../../../../lib/admin_analytics/types";

const OVERVIEW_CACHE_TTL_MS = 45_000;

type OverviewCacheEntry = {
  expiresAt: number;
  payload: AdminAnalyticsOverviewResponse;
};

const overviewCache = new Map<string, OverviewCacheEntry>();

const cleanupExpiredEntries = (now: number): void => {
  for (const [key, value] of overviewCache.entries()) {
    if (value.expiresAt <= now) {
      overviewCache.delete(key);
    }
  }
};

export const GET = async (request: Request): Promise<Response> => {
  const parsed = parseFiltersFromRequest(request);
  if (!parsed.ok) {
    return parsed.response;
  }

  const cacheKey = JSON.stringify(parsed.filters);
  const now = Date.now();
  const cached = overviewCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return NextResponse.json(cached.payload, { status: 200 });
  }

  cleanupExpiredEntries(now);

  return executeProviderCall(async (provider) => {
    const payload = await provider.getOverview(parsed.filters);
    const cachedAt = Date.now();
    overviewCache.set(cacheKey, {
      expiresAt: cachedAt + OVERVIEW_CACHE_TTL_MS,
      payload
    });
    return payload;
  });
};

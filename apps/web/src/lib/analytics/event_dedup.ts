const EVENT_DEDUP_TTL_MS = 24 * 60 * 60 * 1000;
const DEDUP_CLEANUP_INTERVAL_MS = 60 * 1000;

const eventDedupState = new Map<string, number>();
let lastCleanupAt = 0;

const cleanupDedupState = (now: number): void => {
  if (now - lastCleanupAt < DEDUP_CLEANUP_INTERVAL_MS) {
    return;
  }

  lastCleanupAt = now;
  for (const [eventId, expiresAt] of eventDedupState) {
    if (expiresAt <= now) {
      eventDedupState.delete(eventId);
    }
  }
};

export const shouldEmitEvent = (eventId: string, now = Date.now()): boolean => {
  cleanupDedupState(now);

  const expiresAt = eventDedupState.get(eventId);
  if (expiresAt && expiresAt > now) {
    return false;
  }

  eventDedupState.set(eventId, now + EVENT_DEDUP_TTL_MS);
  return true;
};

export const resetEventDedupCache = (): void => {
  eventDedupState.clear();
};

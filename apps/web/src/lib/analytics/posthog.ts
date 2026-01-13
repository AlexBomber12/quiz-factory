import type { AnalyticsEventName, AnalyticsEventProperties } from "./events";

type CapturePayload = {
  api_key: string;
  event: AnalyticsEventName;
  distinct_id: string;
  properties: AnalyticsEventProperties;
  timestamp: string;
};

const RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 200;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const capturePosthogEvent = async (
  eventName: AnalyticsEventName,
  properties: AnalyticsEventProperties,
  fetchFn: typeof fetch = fetch
): Promise<{ ok: boolean; skipped: boolean }> => {
  const apiKey = process.env.POSTHOG_SERVER_KEY;
  if (!apiKey) {
    return { ok: false, skipped: true };
  }

  const host = process.env.POSTHOG_HOST ?? "https://app.posthog.com";
  const url = new URL("/capture/", host).toString();

  const propertiesWithGeo: AnalyticsEventProperties & { $geoip_disable?: boolean } = {
    ...properties
  };
  if (!Object.prototype.hasOwnProperty.call(propertiesWithGeo, "$geoip_disable")) {
    propertiesWithGeo.$geoip_disable = true;
  }

  const payload: CapturePayload = {
    api_key: apiKey,
    event: eventName,
    distinct_id: properties.distinct_id,
    properties: propertiesWithGeo,
    timestamp: properties.timestamp_utc
  };

  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchFn(url, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        return { ok: true, skipped: false };
      }
    } catch {
      // Best-effort retry.
    }

    if (attempt < RETRY_ATTEMPTS - 1) {
      await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
    }
  }

  return { ok: false, skipped: false };
};

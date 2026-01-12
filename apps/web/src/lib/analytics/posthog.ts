import type { AnalyticsEventName, AnalyticsEventProperties } from "./events";

type CapturePayload = {
  api_key: string;
  event: AnalyticsEventName;
  distinct_id: string;
  properties: AnalyticsEventProperties;
  timestamp: string;
};

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

  const payload: CapturePayload = {
    api_key: apiKey,
    event: eventName,
    distinct_id: properties.distinct_id,
    properties,
    timestamp: properties.timestamp_utc
  };

  const response = await fetchFn(url, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return { ok: response.ok, skipped: false };
};

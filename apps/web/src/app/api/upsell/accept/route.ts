import { handleAnalyticsEvent } from "../../../../lib/analytics/server";
import {
  DEFAULT_EVENT_BODY_BYTES,
  DEFAULT_EVENT_RATE_LIMIT,
  assertAllowedHostAsync,
  assertAllowedMethod,
  assertAllowedOriginAsync,
  assertMaxBodyBytes,
  rateLimit
} from "../../../../lib/security/request_guards";

export const POST = async (request: Request): Promise<Response> => {
  const methodResponse = assertAllowedMethod(request, ["POST"]);
  if (methodResponse) {
    return methodResponse;
  }

  const hostResponse = await assertAllowedHostAsync(request);
  if (hostResponse) {
    return hostResponse;
  }

  const originResponse = await assertAllowedOriginAsync(request);
  if (originResponse) {
    return originResponse;
  }

  const rateLimitResponse = rateLimit(request, DEFAULT_EVENT_RATE_LIMIT);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const bodyResponse = await assertMaxBodyBytes(request, DEFAULT_EVENT_BODY_BYTES);
  if (bodyResponse) {
    return bodyResponse;
  }

  return handleAnalyticsEvent(request, {
    event: "upsell_accept",
    requirePurchaseId: true,
    requireAttemptToken: true
  });
};

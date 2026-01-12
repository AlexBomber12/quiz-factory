import { handleAnalyticsEvent } from "../../../../lib/analytics/server";

export const POST = async (request: Request): Promise<Response> => {
  return handleAnalyticsEvent(request, { event: "checkout_start" });
};

import { handleAnalyticsEvent } from "@/lib/analytics/server";
import { withApiGuards } from "@/lib/security/with_api_guards";

export const POST = withApiGuards(async (request: Request): Promise<Response> => {
  return handleAnalyticsEvent(request, {
    event: "test_start",
    createSession: true,
    issueAttemptToken: true
  });
}, { methods: ["POST"] });

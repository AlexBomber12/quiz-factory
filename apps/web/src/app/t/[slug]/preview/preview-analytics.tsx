"use client";

import { useEffect } from "react";

type PreviewAnalyticsProps = {
  testId: string;
  sessionId: string;
  attemptToken?: string | null;
};

export default function PreviewAnalytics({
  testId,
  sessionId,
  attemptToken
}: PreviewAnalyticsProps) {
  useEffect(() => {
    const payload: Record<string, string> = {
      test_id: testId,
      session_id: sessionId
    };
    if (attemptToken) {
      payload.attempt_token = attemptToken;
    }

    void fetch("/api/result/preview", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    }).catch(() => null);
  }, [testId, sessionId, attemptToken]);

  return null;
}

"use client";

import { useEffect } from "react";

type ReportAnalyticsProps = {
  testId: string;
  purchaseId: string;
  sessionId?: string | null;
};

export default function ReportAnalytics({
  testId,
  purchaseId,
  sessionId
}: ReportAnalyticsProps) {
  useEffect(() => {
    const payload: Record<string, string> = {
      test_id: testId,
      purchase_id: purchaseId
    };
    if (sessionId) {
      payload.session_id = sessionId;
    }

    void fetch("/api/report/view", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    }).catch(() => null);
  }, [testId, purchaseId, sessionId]);

  return null;
}

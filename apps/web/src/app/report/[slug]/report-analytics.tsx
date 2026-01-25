"use client";

import { useEffect } from "react";

type ReportAnalyticsProps = {
  testId: string;
  purchaseId: string;
  sessionId?: string | null;
  consumedCredit?: boolean | null;
  creditsBalanceAfter?: number | null;
};

export default function ReportAnalytics({
  testId,
  purchaseId,
  sessionId,
  consumedCredit,
  creditsBalanceAfter
}: ReportAnalyticsProps) {
  useEffect(() => {
    const payload: Record<string, unknown> = {
      test_id: testId,
      purchase_id: purchaseId
    };
    if (sessionId) {
      payload.session_id = sessionId;
    }
    if (typeof consumedCredit === "boolean") {
      payload.consumed_credit = consumedCredit;
    }
    if (typeof creditsBalanceAfter === "number" && Number.isFinite(creditsBalanceAfter)) {
      payload.credits_balance_after = creditsBalanceAfter;
    }

    void fetch("/api/report/view", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    }).catch(() => null);
  }, [testId, purchaseId, sessionId, consumedCredit, creditsBalanceAfter]);

  return null;
}

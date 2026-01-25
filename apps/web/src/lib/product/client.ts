type StartAttemptResponse = {
  session_id: string;
  attempt_token: string;
};

type AttemptContextParams = {
  test_id: string;
  session_id: string;
  attempt_token: string;
};

type AttemptEntryPageViewParams = AttemptContextParams & {
  page_type: "attempt_entry";
  page_url: string;
};

type ReportPdfParams = {
  test_id: string;
  purchase_id: string;
};

type ShareClickParams = {
  test_id: string;
  session_id: string;
  share_target: string;
};

type UpsellEventParams = {
  test_id: string;
  purchase_id: string;
  session_id: string;
  upsell_id: string;
};

const postJson = async (url: string, body: Record<string, unknown>): Promise<Response> => {
  return fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
};

const requireString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export const startAttempt = async (testId: string): Promise<StartAttemptResponse> => {
  const response = await postJson("/api/test/start", { test_id: testId });
  if (!response.ok) {
    throw new Error("Failed to start attempt.");
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const sessionId = requireString(payload.session_id);
  const attemptToken = requireString(payload.attempt_token);

  if (!attemptToken) {
    throw new Error("Attempt token missing.");
  }

  if (!sessionId) {
    throw new Error("Session id missing.");
  }

  return {
    session_id: sessionId,
    attempt_token: attemptToken
  };
};

export const emitAttemptEntryPageView = async (
  params: AttemptEntryPageViewParams
): Promise<void> => {
  const response = await postJson("/api/page/view", params);
  if (!response.ok) {
    throw new Error("Failed to emit attempt entry page view.");
  }
};

export const emitReportPdfDownload = async (params: ReportPdfParams): Promise<Response> => {
  const response = await postJson("/api/report/pdf", params);
  if (!response.ok) {
    throw new Error("Failed to emit report pdf download.");
  }

  return response;
};

export const emitShareClick = async (params: ShareClickParams): Promise<void> => {
  const response = await postJson("/api/share/click", params);
  if (!response.ok) {
    throw new Error("Failed to emit share click.");
  }
};

export const emitUpsellView = async (params: UpsellEventParams): Promise<void> => {
  const response = await postJson("/api/upsell/view", params);
  if (!response.ok) {
    throw new Error("Failed to emit upsell view.");
  }
};

export const emitUpsellAccept = async (params: UpsellEventParams): Promise<void> => {
  const response = await postJson("/api/upsell/accept", params);
  if (!response.ok) {
    throw new Error("Failed to emit upsell accept.");
  }
};

export const completeAttempt = async (params: AttemptContextParams): Promise<void> => {
  const response = await postJson("/api/test/complete", params);
  if (!response.ok) {
    throw new Error("Failed to complete attempt.");
  }
};

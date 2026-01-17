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

export const completeAttempt = async (params: AttemptContextParams): Promise<void> => {
  const response = await postJson("/api/test/complete", params);
  if (!response.ok) {
    throw new Error("Failed to complete attempt.");
  }
};

import { normalizeString } from "@/lib/utils/strings";

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const REQUEST_TIMEOUT_MS = 15_000;

type CreateStructuredJsonResponseInput = {
  model: string;
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  maxOutputTokens?: number;
};


const requireNonEmptyString = (value: string, name: string): string => {
  const normalized = normalizeString(value);
  if (!normalized) {
    throw new Error(`${name} is required.`);
  }
  return normalized;
};

const resolveBaseUrl = (): string => {
  const configuredBaseUrl = normalizeString(process.env.OPENAI_BASE_URL) ?? DEFAULT_OPENAI_BASE_URL;
  return configuredBaseUrl.endsWith("/") ? configuredBaseUrl.slice(0, -1) : configuredBaseUrl;
};

const resolveApiKey = (): string => {
  const apiKey = normalizeString(process.env.OPENAI_API_KEY);
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required.");
  }

  return apiKey;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const extractOpenAiErrorMessage = (payload: unknown): string | null => {
  if (!isRecord(payload) || !isRecord(payload.error)) {
    return null;
  }

  return normalizeString(payload.error.message);
};

export const extractOutputText = (payload: unknown): string => {
  if (!isRecord(payload) || !Array.isArray(payload.output)) {
    return "";
  }

  const parts: string[] = [];
  for (const outputItem of payload.output) {
    if (!isRecord(outputItem) || !Array.isArray(outputItem.content)) {
      continue;
    }

    for (const contentItem of outputItem.content) {
      if (!isRecord(contentItem) || contentItem.type !== "output_text") {
        continue;
      }

      if (typeof contentItem.output_text === "string") {
        parts.push(contentItem.output_text);
        continue;
      }

      if (typeof contentItem.text === "string") {
        parts.push(contentItem.text);
      }
    }
  }

  return parts.join("");
};

export const createStructuredJsonResponse = async <T>({
  model,
  system,
  user,
  schemaName,
  schema,
  maxOutputTokens
}: CreateStructuredJsonResponseInput): Promise<T> => {
  const normalizedModel = requireNonEmptyString(model, "model");
  const normalizedSystem = requireNonEmptyString(system, "system");
  const normalizedUser = requireNonEmptyString(user, "user");
  const normalizedSchemaName = requireNonEmptyString(schemaName, "schemaName");

  const payload: Record<string, unknown> = {
    model: normalizedModel,
    input: [
      {
        role: "system",
        content: normalizedSystem
      },
      {
        role: "user",
        content: normalizedUser
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: normalizedSchemaName,
        schema,
        strict: true
      }
    }
  };

  if (typeof maxOutputTokens === "number" && Number.isInteger(maxOutputTokens) && maxOutputTokens > 0) {
    payload.max_output_tokens = maxOutputTokens;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${resolveBaseUrl()}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resolveApiKey()}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("OpenAI request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  let responsePayload: unknown;
  try {
    responsePayload = await response.json();
  } catch {
    throw new Error("OpenAI response was not valid JSON.");
  }

  if (!response.ok) {
    const apiError = extractOpenAiErrorMessage(responsePayload);
    if (apiError) {
      throw new Error(`OpenAI error: ${apiError}`);
    }

    throw new Error(`OpenAI error: ${response.status}`);
  }

  const outputText = extractOutputText(responsePayload);
  if (!outputText) {
    throw new Error("OpenAI response did not include output_text.");
  }

  try {
    return JSON.parse(outputText) as T;
  } catch {
    throw new Error("OpenAI output_text was not valid JSON.");
  }
};

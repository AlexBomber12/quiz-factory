import { env } from "@/lib/env";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  ADMIN_CSRF_COOKIE,
  isAdminCsrfTokenValid,
  normalizeAdminCsrfToken,
  readAdminCsrfTokenFromFormData,
  readAdminCsrfTokenFromHeader,
  readAdminCsrfTokenFromJson
} from "@/lib/admin/csrf";
import { logAdminEvent } from "@/lib/admin/audit";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin/session";
import {
  buildAlertInsightMarkdown,
  buildAlertInsightPrompt,
  generateAlertInsightFromPrompt
} from "@/lib/alerts/insight";
import {
  getAlertAiInsightByInstanceId,
  getAlertInstanceWithRuleById,
  upsertAlertAiInsight
} from "@/lib/alerts/repo";

const DEFAULT_OPENAI_MODEL = "gpt-4o";
const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

type ParsedInsightPayload = {
  force: boolean;
  csrfToken: string | null;
};

const normalizeNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseBoolean = (value: unknown): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return false;
  }

  return TRUE_VALUES.has(value.trim().toLowerCase());
};

const resolveParams = async (params: RouteContext["params"]): Promise<{ id: string }> => {
  return Promise.resolve(params);
};

const resolveModel = (): string => {
  return normalizeNonEmptyString(env.OPENAI_MODEL) ?? DEFAULT_OPENAI_MODEL;
};

const hasOpenAiApiKey = (): boolean => {
  return Boolean(normalizeNonEmptyString(env.OPENAI_API_KEY));
};

const parsePayloadFromJson = async (request: Request): Promise<ParsedInsightPayload> => {
  const body = (await request.json()) as Record<string, unknown>;
  return {
    force: parseBoolean(body.force),
    csrfToken: readAdminCsrfTokenFromHeader(request) ?? readAdminCsrfTokenFromJson(body)
  };
};

const parsePayloadFromForm = async (request: Request): Promise<ParsedInsightPayload> => {
  const formData = await request.formData();
  return {
    force: parseBoolean(formData.get("force")),
    csrfToken: readAdminCsrfTokenFromHeader(request) ?? readAdminCsrfTokenFromFormData(formData)
  };
};

const parsePayload = async (request: Request): Promise<ParsedInsightPayload> => {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return parsePayloadFromJson(request);
  }
  return parsePayloadFromForm(request);
};

const buildErrorResponse = (code: string, status: number, detail?: string): Response => {
  return NextResponse.json(
    {
      error: code,
      detail: detail ?? null
    },
    { status }
  );
};

export const GET = async (_request: Request, context: RouteContext): Promise<Response> => {
  const { id } = await resolveParams(context.params);

  const cookieStore = await cookies();
  const session = await verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return buildErrorResponse("unauthorized", 401);
  }

  try {
    const alertInstance = await getAlertInstanceWithRuleById(id);
    if (!alertInstance) {
      return buildErrorResponse("not_found", 404);
    }

    const insight = await getAlertAiInsightByInstanceId(id);
    if (!insight) {
      return buildErrorResponse("insight_not_found", 404);
    }

    return NextResponse.json(
      {
        ok: true,
        insight
      },
      { status: 200 }
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : undefined;
    return buildErrorResponse("db_error", 500, detail);
  }
};

export const POST = async (request: Request, context: RouteContext): Promise<Response> => {
  const { id } = await resolveParams(context.params);

  const cookieStore = await cookies();
  const session = await verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return buildErrorResponse("unauthorized", 401);
  }

  let parsedPayload: ParsedInsightPayload;
  try {
    parsedPayload = await parsePayload(request);
  } catch {
    return buildErrorResponse("invalid_payload", 400);
  }

  const forceFromQuery = parseBoolean(new URL(request.url).searchParams.get("force"));
  const force = forceFromQuery || parsedPayload.force;
  const csrfCookieToken = normalizeAdminCsrfToken(cookieStore.get(ADMIN_CSRF_COOKIE)?.value);
  if (!isAdminCsrfTokenValid(csrfCookieToken, parsedPayload.csrfToken)) {
    return buildErrorResponse("invalid_csrf", 403);
  }

  try {
    const alertInstance = await getAlertInstanceWithRuleById(id);
    if (!alertInstance) {
      return buildErrorResponse("not_found", 404);
    }

    const model = resolveModel();
    const prompt = buildAlertInsightPrompt({
      instance: alertInstance,
      model
    });
    const existingInsight = await getAlertAiInsightByInstanceId(id);
    const isPromptCacheHit = existingInsight?.prompt_hash === prompt.prompt_hash;
    if (isPromptCacheHit && !force) {
      return NextResponse.json(
        {
          ok: true,
          cached: true,
          insight: existingInsight
        },
        { status: 200 }
      );
    }

    if (!hasOpenAiApiKey()) {
      return buildErrorResponse("openai_not_configured", 409);
    }

    const insightPayload = await generateAlertInsightFromPrompt({
      model,
      prompt
    });
    const persistedInsight = await upsertAlertAiInsight({
      alert_instance_id: id,
      model,
      prompt_hash: prompt.prompt_hash,
      insight_md: buildAlertInsightMarkdown(insightPayload),
      actions_json: insightPayload
    });

    void logAdminEvent({
      actor: session.role,
      action: existingInsight ? "alert_insight_regenerated" : "alert_insight_generated",
      entity_type: "alert_instance",
      entity_id: id,
      metadata: {
        force,
        model,
        prompt_hash: prompt.prompt_hash
      }
    }).catch(() => undefined);

    return NextResponse.json(
      {
        ok: true,
        cached: false,
        insight: persistedInsight
      },
      { status: 200 }
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : undefined;
    return buildErrorResponse("insight_generation_failed", 500, detail);
  }
};

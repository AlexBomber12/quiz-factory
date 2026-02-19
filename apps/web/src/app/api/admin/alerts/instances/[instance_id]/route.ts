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
import { updateAlertInstanceStatus } from "@/lib/alerts/repo";
import { ALERT_INSTANCE_STATUSES, type AlertInstanceStatus } from "@/lib/alerts/types";
import { buildRedirectUrl } from "@/lib/security/redirect_base";

type RouteContext = {
  params: Promise<{ instance_id: string }> | { instance_id: string };
};

type ParsedStatusPayload = {
  status: AlertInstanceStatus;
  csrfToken: string | null;
};

const STATUS_SET = new Set<string>(ALERT_INSTANCE_STATUSES);

const normalizeNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const resolveParams = async (params: RouteContext["params"]): Promise<{ instance_id: string }> => {
  return Promise.resolve(params);
};

const parseStatus = (value: unknown): AlertInstanceStatus => {
  const normalized = normalizeNonEmptyString(value)?.toLowerCase();
  if (!normalized || !STATUS_SET.has(normalized)) {
    throw new Error("status is invalid");
  }

  return normalized as AlertInstanceStatus;
};

const parsePayloadFromJson = async (request: Request): Promise<ParsedStatusPayload> => {
  const body = (await request.json()) as Record<string, unknown>;
  return {
    status: parseStatus(body.status),
    csrfToken: readAdminCsrfTokenFromHeader(request) ?? readAdminCsrfTokenFromJson(body)
  };
};

const parsePayloadFromForm = async (request: Request): Promise<ParsedStatusPayload> => {
  const formData = await request.formData();
  return {
    status: parseStatus(formData.get("status")),
    csrfToken: readAdminCsrfTokenFromHeader(request) ?? readAdminCsrfTokenFromFormData(formData)
  };
};

const parsePayload = async (request: Request): Promise<ParsedStatusPayload> => {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return parsePayloadFromJson(request);
  }

  return parsePayloadFromForm(request);
};

const prefersJson = (request: Request): boolean => {
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("application/json");
};

const buildErrorResponse = (
  request: Request,
  instanceId: string,
  code: string,
  status: number,
  detail?: string
): Response => {
  if (prefersJson(request)) {
    return NextResponse.json(
      {
        error: code,
        detail: detail ?? null
      },
      { status }
    );
  }

  const redirectUrl = buildRedirectUrl(request, "/admin/alerts");
  redirectUrl.searchParams.set("error", code);
  redirectUrl.searchParams.set("instance_id", instanceId);
  if (detail) {
    redirectUrl.searchParams.set("detail", detail);
  }

  return NextResponse.redirect(redirectUrl, 303);
};

const buildSuccessResponse = (request: Request): Response => {
  if (prefersJson(request)) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const redirectUrl = buildRedirectUrl(request, "/admin/alerts");
  redirectUrl.searchParams.set("updated", "ok");
  return NextResponse.redirect(redirectUrl, 303);
};

const resolveAuditAction = (status: AlertInstanceStatus): string => {
  switch (status) {
    case "acknowledged":
      return "alert_instance_acknowledged";
    case "resolved":
      return "alert_instance_resolved";
    case "open":
    default:
      return "alert_instance_updated";
  }
};

const runPatch = async (request: Request, context: RouteContext): Promise<Response> => {
  const { instance_id: instanceId } = await resolveParams(context.params);

  const cookieStore = await cookies();
  const session = await verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return buildErrorResponse(request, instanceId, "unauthorized", 401);
  }

  let payload: ParsedStatusPayload;
  try {
    payload = await parsePayload(request);
  } catch {
    return buildErrorResponse(request, instanceId, "invalid_payload", 400);
  }

  const csrfCookieToken = normalizeAdminCsrfToken(cookieStore.get(ADMIN_CSRF_COOKIE)?.value);
  if (!isAdminCsrfTokenValid(csrfCookieToken, payload.csrfToken)) {
    return buildErrorResponse(request, instanceId, "invalid_csrf", 403);
  }

  try {
    const updated = await updateAlertInstanceStatus(instanceId, payload.status);
    if (!updated) {
      return buildErrorResponse(request, instanceId, "not_found", 404);
    }

    void logAdminEvent({
      actor: session.role,
      action: resolveAuditAction(payload.status),
      entity_type: "alert_instance",
      entity_id: updated.id,
      metadata: {
        rule_id: updated.rule_id,
        status: updated.status
      }
    }).catch(() => undefined);

    return buildSuccessResponse(request);
  } catch (error) {
    const detail = error instanceof Error ? error.message : undefined;
    return buildErrorResponse(request, instanceId, "db_error", 500, detail);
  }
};

export const PATCH = async (request: Request, context: RouteContext): Promise<Response> => {
  return runPatch(request, context);
};

export const POST = async (request: Request, context: RouteContext): Promise<Response> => {
  const override = new URL(request.url).searchParams.get("_method")?.toUpperCase();
  if (override === "PATCH") {
    return runPatch(request, context);
  }

  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
};

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  ADMIN_CSRF_COOKIE,
  isAdminCsrfTokenValid,
  normalizeAdminCsrfToken,
  readAdminCsrfTokenFromFormData,
  readAdminCsrfTokenFromHeader,
  readAdminCsrfTokenFromJson
} from "../../../../../lib/admin/csrf";
import { logAdminEvent } from "../../../../../lib/admin/audit";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "../../../../../lib/admin/session";
import { createAlertRule } from "../../../../../lib/alerts/repo";
import { ALERT_RULE_TYPES, type AlertRuleType } from "../../../../../lib/alerts/types";
import { buildRedirectUrl } from "../../../../../lib/security/redirect_base";

type ParsedCreatePayload = {
  name: string;
  enabled: boolean;
  rule_type: AlertRuleType;
  scope_json: Record<string, unknown>;
  params_json: Record<string, unknown>;
  csrfToken: string | null;
};

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const RULE_TYPE_SET = new Set<string>(ALERT_RULE_TYPES);

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

const parseRuleType = (value: unknown): AlertRuleType => {
  const normalized = normalizeNonEmptyString(value)?.toLowerCase();
  if (!normalized || !RULE_TYPE_SET.has(normalized)) {
    throw new Error("rule_type is invalid.");
  }

  return normalized as AlertRuleType;
};

const parseRecordObject = (value: unknown, fieldName: string): Record<string, unknown> => {
  if (value === null || value === undefined || value === "") {
    return {};
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error(`${fieldName} must be a JSON object.`);
      }

      return parsed as Record<string, unknown>;
    } catch {
      throw new Error(`${fieldName} must be valid JSON.`);
    }
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object.`);
  }

  return value as Record<string, unknown>;
};

const parsePayloadFromJson = async (request: Request): Promise<ParsedCreatePayload> => {
  const body = (await request.json()) as Record<string, unknown>;
  const name = normalizeNonEmptyString(body.name);
  const ruleType = parseRuleType(body.rule_type);

  if (!name) {
    throw new Error("name and rule_type are required.");
  }

  return {
    name,
    enabled: parseBoolean(body.enabled),
    rule_type: ruleType,
    scope_json: parseRecordObject(body.scope_json, "scope_json"),
    params_json: parseRecordObject(body.params_json, "params_json"),
    csrfToken: readAdminCsrfTokenFromHeader(request) ?? readAdminCsrfTokenFromJson(body)
  };
};

const parsePayloadFromForm = async (request: Request): Promise<ParsedCreatePayload> => {
  const formData = await request.formData();
  const name = normalizeNonEmptyString(formData.get("name"));
  const ruleType = parseRuleType(formData.get("rule_type"));

  if (!name) {
    throw new Error("name and rule_type are required.");
  }

  return {
    name,
    enabled: parseBoolean(formData.get("enabled")),
    rule_type: ruleType,
    scope_json: parseRecordObject(formData.get("scope_json"), "scope_json"),
    params_json: parseRecordObject(formData.get("params_json"), "params_json"),
    csrfToken: readAdminCsrfTokenFromHeader(request) ?? readAdminCsrfTokenFromFormData(formData)
  };
};

const parsePayload = async (request: Request): Promise<ParsedCreatePayload> => {
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

  const redirectUrl = buildRedirectUrl(request, "/admin/alerts/rules");
  redirectUrl.searchParams.set("error", code);
  if (detail) {
    redirectUrl.searchParams.set("detail", detail);
  }

  return NextResponse.redirect(redirectUrl, 303);
};

const buildSuccessResponse = (request: Request, ruleId: string): Response => {
  if (prefersJson(request)) {
    return NextResponse.json(
      {
        ok: true,
        rule_id: ruleId
      },
      { status: 201 }
    );
  }

  const redirectUrl = buildRedirectUrl(request, "/admin/alerts/rules");
  redirectUrl.searchParams.set("created", "ok");
  return NextResponse.redirect(redirectUrl, 303);
};

export const POST = async (request: Request): Promise<Response> => {
  const cookieStore = await cookies();
  const session = await verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return buildErrorResponse(request, "unauthorized", 401);
  }

  if (session.role !== "admin") {
    return buildErrorResponse(request, "forbidden", 403, "Only admin can manage alert rules.");
  }

  let payload: ParsedCreatePayload;
  try {
    payload = await parsePayload(request);
  } catch {
    return buildErrorResponse(request, "invalid_payload", 400);
  }

  const csrfCookieToken = normalizeAdminCsrfToken(cookieStore.get(ADMIN_CSRF_COOKIE)?.value);
  if (!isAdminCsrfTokenValid(csrfCookieToken, payload.csrfToken)) {
    return buildErrorResponse(request, "invalid_csrf", 403);
  }

  try {
    const created = await createAlertRule({
      name: payload.name,
      enabled: payload.enabled,
      rule_type: payload.rule_type,
      scope_json: payload.scope_json,
      params_json: payload.params_json
    });

    void logAdminEvent({
      actor: session.role,
      action: "alert_rule_created",
      entity_type: "alert_rule",
      entity_id: created.id,
      metadata: {
        rule_type: created.rule_type,
        enabled: created.enabled,
        scope_json: created.scope_json
      }
    }).catch(() => undefined);

    return buildSuccessResponse(request, created.id);
  } catch (error) {
    const detail = error instanceof Error ? error.message : undefined;
    return buildErrorResponse(request, "db_error", 500, detail);
  }
};

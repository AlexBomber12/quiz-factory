import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  ADMIN_CSRF_COOKIE,
  isAdminCsrfTokenValid,
  normalizeAdminCsrfToken,
  readAdminCsrfTokenFromFormData,
  readAdminCsrfTokenFromHeader,
  readAdminCsrfTokenFromJson
} from "../../../../../../../lib/admin/csrf";
import { logAdminEvent } from "../../../../../../../lib/admin/audit";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "../../../../../../../lib/admin/session";
import { runAlertRules } from "../../../../../../../lib/alerts/engine";
import { buildRedirectUrl } from "../../../../../../../lib/security/redirect_base";

type RouteContext = {
  params: Promise<{ rule_id: string }> | { rule_id: string };
};

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

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

const resolveParams = async (params: RouteContext["params"]): Promise<{ rule_id: string }> => {
  return Promise.resolve(params);
};

const parseCsrfToken = async (request: Request): Promise<string | null> => {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json()) as Record<string, unknown>;
    return readAdminCsrfTokenFromHeader(request) ?? readAdminCsrfTokenFromJson(body);
  }

  const formData = await request.formData();
  return readAdminCsrfTokenFromHeader(request) ?? readAdminCsrfTokenFromFormData(formData);
};

const parseDryRun = async (request: Request): Promise<boolean> => {
  const queryDryRun = normalizeNonEmptyString(new URL(request.url).searchParams.get("dry_run"));
  if (queryDryRun) {
    return parseBoolean(queryDryRun);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const body = (await request.clone().json()) as Record<string, unknown>;
      return parseBoolean(body.dry_run);
    } catch {
      return false;
    }
  }

  try {
    const formData = await request.clone().formData();
    return parseBoolean(formData.get("dry_run"));
  } catch {
    return false;
  }
};

const prefersJson = (request: Request): boolean => {
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("application/json");
};

const buildErrorResponse = (
  request: Request,
  ruleId: string,
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
  redirectUrl.searchParams.set("rule_id", ruleId);
  if (detail) {
    redirectUrl.searchParams.set("detail", detail);
  }

  return NextResponse.redirect(redirectUrl, 303);
};

const buildSuccessResponse = (request: Request, payload: unknown): Response => {
  if (prefersJson(request)) {
    return NextResponse.json(payload, { status: 200 });
  }

  const redirectUrl = buildRedirectUrl(request, "/admin/alerts/rules");
  redirectUrl.searchParams.set("run", "ok");
  return NextResponse.redirect(redirectUrl, 303);
};

export const POST = async (request: Request, context: RouteContext): Promise<Response> => {
  const { rule_id: ruleId } = await resolveParams(context.params);

  const cookieStore = await cookies();
  const session = await verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return buildErrorResponse(request, ruleId, "unauthorized", 401);
  }

  if (session.role !== "admin") {
    return buildErrorResponse(request, ruleId, "forbidden", 403, "Only admin can run alert rules.");
  }

  const csrfToken = await parseCsrfToken(request);
  const csrfCookieToken = normalizeAdminCsrfToken(cookieStore.get(ADMIN_CSRF_COOKIE)?.value);
  if (!isAdminCsrfTokenValid(csrfCookieToken, csrfToken)) {
    return buildErrorResponse(request, ruleId, "invalid_csrf", 403);
  }

  const dryRun = await parseDryRun(request);

  try {
    const result = await runAlertRules({
      rule_id: ruleId,
      dry_run: dryRun
    });

    void logAdminEvent({
      actor: session.role,
      action: "alert_rule_run",
      entity_type: "alert_rule",
      entity_id: ruleId,
      metadata: {
        dry_run: dryRun,
        evaluated: result.evaluated,
        triggered: result.triggered,
        inserted: result.inserted
      }
    }).catch(() => undefined);

    return buildSuccessResponse(request, {
      ok: true,
      result
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : undefined;
    return buildErrorResponse(request, ruleId, "run_failed", 500, detail);
  }
};

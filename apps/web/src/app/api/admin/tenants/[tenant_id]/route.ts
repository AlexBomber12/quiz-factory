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
import {
  AdminTenantError,
  deleteAdminTenant,
  getAdminTenantDetail,
  updateAdminTenant
} from "../../../../../lib/admin/tenants";
import { logAdminEvent } from "../../../../../lib/admin/audit";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSession,
  type AdminSessionPayload
} from "../../../../../lib/admin/session";
import { buildRedirectUrl } from "../../../../../lib/security/redirect_base";

type RouteContext = {
  params: Promise<{ tenant_id: string }> | { tenant_id: string };
};

type ParsedPatchPayload = {
  default_locale?: string;
  enabled?: boolean;
  csrfToken: string | null;
};

const resolveParams = async (
  params: RouteContext["params"]
): Promise<{ tenant_id: string }> => {
  return Promise.resolve(params);
};

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return null;
};

const prefersJson = (request: Request): boolean => {
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("application/json");
};

const buildDetailRedirect = (
  request: Request,
  tenantId: string,
  params: Record<string, string>
): Response => {
  const redirectUrl = buildRedirectUrl(request, `/admin/tenants/${encodeURIComponent(tenantId)}`);
  for (const [key, value] of Object.entries(params)) {
    redirectUrl.searchParams.set(key, value);
  }

  return NextResponse.redirect(redirectUrl, 303);
};

const buildErrorResponse = (
  request: Request,
  tenantId: string,
  code: string,
  status: number,
  detail?: string | null
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

  return buildDetailRedirect(request, tenantId, {
    error: code,
    ...(detail ? { detail } : {})
  });
};

const parsePatchPayloadFromJson = async (
  request: Request
): Promise<ParsedPatchPayload> => {
  const rawBody = await request.json();
  if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
    throw new AdminTenantError("invalid_payload", 400);
  }
  const body = rawBody as Record<string, unknown>;
  let enabled: boolean | undefined;
  if (Object.prototype.hasOwnProperty.call(body, "enabled")) {
    const parsedEnabled = normalizeBoolean(body.enabled);
    if (parsedEnabled === null) {
      throw new AdminTenantError("invalid_payload", 400, "enabled must be true or false.");
    }
    enabled = parsedEnabled;
  }

  return {
    default_locale: normalizeString(body.default_locale) ?? undefined,
    enabled,
    csrfToken: readAdminCsrfTokenFromHeader(request) ?? readAdminCsrfTokenFromJson(body)
  };
};

const parsePatchPayloadFromFormData = async (
  request: Request
): Promise<ParsedPatchPayload> => {
  const formData = await request.formData();
  const enabledInput = formData.get("enabled");
  let enabled: boolean | undefined;
  if (enabledInput !== null) {
    const parsedEnabled = normalizeBoolean(enabledInput);
    if (parsedEnabled === null) {
      throw new AdminTenantError("invalid_payload", 400, "enabled must be true or false.");
    }
    enabled = parsedEnabled;
  }

  return {
    default_locale: normalizeString(formData.get("default_locale")) ?? undefined,
    enabled,
    csrfToken: readAdminCsrfTokenFromHeader(request) ?? readAdminCsrfTokenFromFormData(formData)
  };
};

const parsePatchPayload = async (request: Request): Promise<ParsedPatchPayload> => {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return parsePatchPayloadFromJson(request);
  }

  return parsePatchPayloadFromFormData(request);
};

const parseCsrfToken = async (request: Request): Promise<string | null> => {
  const headerToken = readAdminCsrfTokenFromHeader(request);
  if (headerToken) {
    return headerToken;
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const body = (await request.json()) as Record<string, unknown>;
      return readAdminCsrfTokenFromJson(body);
    } catch {
      return null;
    }
  }

  try {
    const formData = await request.formData();
    return readAdminCsrfTokenFromFormData(formData);
  } catch {
    return null;
  }
};

const requireAdminSession = async (
  request: Request,
  tenantId: string,
  requireAdmin: boolean
): Promise<AdminSessionPayload | Response> => {
  const cookieStore = await cookies();
  const session = await verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return buildErrorResponse(request, tenantId, "unauthorized", 401);
  }

  if (requireAdmin && session.role !== "admin") {
    return buildErrorResponse(request, tenantId, "forbidden", 403, "Only admin can modify tenants.");
  }

  return session;
};

const validateCsrf = async (
  request: Request,
  csrfToken: string | null
): Promise<boolean> => {
  const cookieStore = await cookies();
  const csrfCookieToken = normalizeAdminCsrfToken(
    cookieStore.get(ADMIN_CSRF_COOKIE)?.value
  );

  return isAdminCsrfTokenValid(csrfCookieToken, csrfToken);
};

const runPatch = async (
  request: Request,
  context: RouteContext
): Promise<Response> => {
  const { tenant_id: tenantId } = await resolveParams(context.params);
  const session = await requireAdminSession(request, tenantId, true);
  if (session instanceof Response) {
    return session;
  }

  let payload: ParsedPatchPayload;
  try {
    payload = await parsePatchPayload(request);
  } catch (error) {
    if (error instanceof AdminTenantError) {
      return buildErrorResponse(
        request,
        tenantId,
        error.code,
        error.status,
        error.detail
      );
    }
    return buildErrorResponse(request, tenantId, "invalid_payload", 400);
  }

  if (!(await validateCsrf(request, payload.csrfToken))) {
    return buildErrorResponse(request, tenantId, "invalid_csrf", 403);
  }

  try {
    await updateAdminTenant(tenantId, {
      default_locale: payload.default_locale,
      enabled: payload.enabled
    });

    void logAdminEvent({
      actor: session.role,
      action: "tenant_updated",
      entity_type: "tenant",
      entity_id: tenantId,
      metadata: {
        default_locale: payload.default_locale ?? null,
        enabled: payload.enabled ?? null
      }
    }).catch(() => undefined);

    if (prefersJson(request)) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    return buildDetailRedirect(request, tenantId, { updated: "ok" });
  } catch (error) {
    if (error instanceof AdminTenantError) {
      return buildErrorResponse(request, tenantId, error.code, error.status, error.detail);
    }

    return buildErrorResponse(request, tenantId, "db_error", 500);
  }
};

const runDelete = async (
  request: Request,
  context: RouteContext
): Promise<Response> => {
  const { tenant_id: tenantId } = await resolveParams(context.params);
  const session = await requireAdminSession(request, tenantId, true);
  if (session instanceof Response) {
    return session;
  }

  const csrfToken = await parseCsrfToken(request);
  if (!(await validateCsrf(request, csrfToken))) {
    return buildErrorResponse(request, tenantId, "invalid_csrf", 403);
  }

  try {
    await deleteAdminTenant(tenantId);

    void logAdminEvent({
      actor: session.role,
      action: "tenant_deleted",
      entity_type: "tenant",
      entity_id: tenantId,
      metadata: {}
    }).catch(() => undefined);

    if (prefersJson(request)) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const redirectUrl = buildRedirectUrl(request, "/admin/tenants");
    redirectUrl.searchParams.set("deleted", tenantId);
    return NextResponse.redirect(redirectUrl, 303);
  } catch (error) {
    if (error instanceof AdminTenantError) {
      return buildErrorResponse(request, tenantId, error.code, error.status, error.detail);
    }

    return buildErrorResponse(request, tenantId, "db_error", 500);
  }
};

export const GET = async (
  request: Request,
  context: RouteContext
): Promise<Response> => {
  const { tenant_id: tenantId } = await resolveParams(context.params);
  const session = await requireAdminSession(request, tenantId, false);
  if (session instanceof Response) {
    return session;
  }

  try {
    const detail = await getAdminTenantDetail(tenantId);
    if (!detail.tenant) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json(detail, { status: 200 });
  } catch {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
};

export const PATCH = async (
  request: Request,
  context: RouteContext
): Promise<Response> => {
  return runPatch(request, context);
};

export const DELETE = async (
  request: Request,
  context: RouteContext
): Promise<Response> => {
  return runDelete(request, context);
};

export const POST = async (
  request: Request,
  context: RouteContext
): Promise<Response> => {
  const override = new URL(request.url).searchParams.get("_method")?.toUpperCase();
  if (override === "PATCH") {
    return runPatch(request, context);
  }

  if (override === "DELETE") {
    return runDelete(request, context);
  }

  const { tenant_id: tenantId } = await resolveParams(context.params);
  return buildErrorResponse(request, tenantId, "method_not_allowed", 405);
};

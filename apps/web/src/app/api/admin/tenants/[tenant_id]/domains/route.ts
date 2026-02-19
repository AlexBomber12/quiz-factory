import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { requestContext } from "@/lib/logger_context";

import {
  ADMIN_CSRF_COOKIE,
  isAdminCsrfTokenValid,
  normalizeAdminCsrfToken,
  readAdminCsrfTokenFromFormData,
  readAdminCsrfTokenFromHeader,
  readAdminCsrfTokenFromJson
} from "@/lib/admin/csrf";
import {
  AdminTenantError,
  addAdminTenantDomain,
  removeAdminTenantDomain
} from "@/lib/admin/tenants";
import { logAdminEvent } from "@/lib/admin/audit";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSession,
  type AdminSessionPayload
} from "@/lib/admin/session";
import { buildRedirectUrl } from "@/lib/security/redirect_base";
import { normalizeString } from "@/lib/utils/strings";

type RouteContext = {
  params: Promise<{ tenant_id: string }> | { tenant_id: string };
};

type ParsedDomainPayload = {
  domain: string;
  csrfToken: string | null;
};

const resolveParams = async (
  params: RouteContext["params"]
): Promise<{ tenant_id: string }> => {
  return Promise.resolve(params);
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
    domain_error: code,
    ...(detail ? { detail } : {})
  });
};

const parsePayloadFromJson = async (request: Request): Promise<ParsedDomainPayload> => {
  const body = (await request.json()) as Record<string, unknown>;
  const domain = normalizeString(body.domain);
  if (!domain) {
    throw new AdminTenantError("invalid_payload", 400, "domain is required.");
  }

  return {
    domain,
    csrfToken: readAdminCsrfTokenFromHeader(request) ?? readAdminCsrfTokenFromJson(body)
  };
};

const parsePayloadFromFormData = async (request: Request): Promise<ParsedDomainPayload> => {
  const formData = await request.formData();
  const domain = normalizeString(formData.get("domain"));
  if (!domain) {
    throw new AdminTenantError("invalid_payload", 400, "domain is required.");
  }

  return {
    domain,
    csrfToken: readAdminCsrfTokenFromHeader(request) ?? readAdminCsrfTokenFromFormData(formData)
  };
};

const parsePayload = async (request: Request): Promise<ParsedDomainPayload> => {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return parsePayloadFromJson(request);
  }

  return parsePayloadFromFormData(request);
};

const requireAdminSession = async (
  request: Request,
  tenantId: string
): Promise<AdminSessionPayload | Response> => {
  const cookieStore = await cookies();
  const session = await verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return buildErrorResponse(request, tenantId, "unauthorized", 401);
  }

  if (session.role !== "admin") {
    return buildErrorResponse(request, tenantId, "forbidden", 403, "Only admin can modify tenants.");
  }

  return session;
};

const validateCsrf = async (csrfToken: string | null): Promise<boolean> => {
  const cookieStore = await cookies();
  const csrfCookieToken = normalizeAdminCsrfToken(
    cookieStore.get(ADMIN_CSRF_COOKIE)?.value
  );

  return isAdminCsrfTokenValid(csrfCookieToken, csrfToken);
};

const runAdd = async (request: Request, context: RouteContext): Promise<Response> => {
  const { tenant_id: tenantId } = await resolveParams(context.params);
  const session = await requireAdminSession(request, tenantId);
  if (session instanceof Response) {
    return session;
  }

  let payload: ParsedDomainPayload;
  try {
    payload = await parsePayload(request);
  } catch (error) {
    logger.error({ error, ...requestContext(request) }, "app/api/admin/tenants/[tenant_id]/domains/route.ts operation failed");
    return buildErrorResponse(request, tenantId, "invalid_payload", 400);
  }

  if (!(await validateCsrf(payload.csrfToken))) {
    return buildErrorResponse(request, tenantId, "invalid_csrf", 403);
  }

  try {
    const domain = await addAdminTenantDomain(tenantId, payload.domain);

    void logAdminEvent({
      actor: session.role,
      action: "tenant_domain_added",
      entity_type: "tenant",
      entity_id: tenantId,
      metadata: {
        domain
      }
    }).catch(() => undefined);

    if (prefersJson(request)) {
      return NextResponse.json({ ok: true, domain }, { status: 200 });
    }

    return buildDetailRedirect(request, tenantId, { domain_added: "ok" });
  } catch (error) {
    if (error instanceof AdminTenantError) {
      return buildErrorResponse(request, tenantId, error.code, error.status, error.detail);
    }

    return buildErrorResponse(request, tenantId, "db_error", 500);
  }
};

const runDelete = async (request: Request, context: RouteContext): Promise<Response> => {
  const { tenant_id: tenantId } = await resolveParams(context.params);
  const session = await requireAdminSession(request, tenantId);
  if (session instanceof Response) {
    return session;
  }

  let payload: ParsedDomainPayload;
  try {
    payload = await parsePayload(request);
  } catch (error) {
    logger.error({ error, ...requestContext(request) }, "app/api/admin/tenants/[tenant_id]/domains/route.ts operation failed");
    return buildErrorResponse(request, tenantId, "invalid_payload", 400);
  }

  if (!(await validateCsrf(payload.csrfToken))) {
    return buildErrorResponse(request, tenantId, "invalid_csrf", 403);
  }

  try {
    await removeAdminTenantDomain(tenantId, payload.domain);

    void logAdminEvent({
      actor: session.role,
      action: "tenant_domain_removed",
      entity_type: "tenant",
      entity_id: tenantId,
      metadata: {
        domain: payload.domain
      }
    }).catch(() => undefined);

    if (prefersJson(request)) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    return buildDetailRedirect(request, tenantId, { domain_removed: "ok" });
  } catch (error) {
    if (error instanceof AdminTenantError) {
      return buildErrorResponse(request, tenantId, error.code, error.status, error.detail);
    }

    return buildErrorResponse(request, tenantId, "db_error", 500);
  }
};

export const POST = async (
  request: Request,
  context: RouteContext
): Promise<Response> => {
  const override = new URL(request.url).searchParams.get("_method")?.toUpperCase();
  if (override === "DELETE") {
    return runDelete(request, context);
  }

  return runAdd(request, context);
};

export const DELETE = async (
  request: Request,
  context: RouteContext
): Promise<Response> => {
  return runDelete(request, context);
};

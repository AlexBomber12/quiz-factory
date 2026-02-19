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
  createAdminTenant,
  getAdminTenantsSource,
  listAdminTenantsWithCounts
} from "@/lib/admin/tenants";
import { logAdminEvent } from "@/lib/admin/audit";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin/session";
import { buildRedirectUrl } from "@/lib/security/redirect_base";
import { normalizeString } from "@/lib/utils/strings";

type ParsedCreatePayload = {
  tenant_id: string;
  default_locale: string;
  enabled?: boolean;
  domains: string[];
  csrfToken: string | null;
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

const parseDomainsFromRecord = (record: Record<string, unknown>): string[] => {
  const values: string[] = [];

  if (Array.isArray(record.domains)) {
    for (const entry of record.domains) {
      const normalized = normalizeString(entry);
      if (normalized) {
        values.push(normalized);
      }
    }
  } else {
    const asSingle = normalizeString(record.domains);
    if (asSingle) {
      values.push(asSingle);
    }
  }

  const single = normalizeString(record.domain);
  if (single) {
    values.push(single);
  }

  return values;
};

const parseCreatePayloadFromJson = async (
  request: Request
): Promise<ParsedCreatePayload> => {
  const body = (await request.json()) as Record<string, unknown>;
  const tenantId = normalizeString(body.tenant_id);
  const defaultLocale = normalizeString(body.default_locale);
  const enabled = normalizeBoolean(body.enabled);

  if (!tenantId || !defaultLocale) {
    throw new AdminTenantError("invalid_payload", 400, "tenant_id and default_locale are required.");
  }

  return {
    tenant_id: tenantId,
    default_locale: defaultLocale,
    enabled: enabled === null ? undefined : enabled,
    domains: parseDomainsFromRecord(body),
    csrfToken: readAdminCsrfTokenFromHeader(request) ?? readAdminCsrfTokenFromJson(body)
  };
};

const parseCreatePayloadFromFormData = async (
  request: Request
): Promise<ParsedCreatePayload> => {
  const formData = await request.formData();

  const tenantId = normalizeString(formData.get("tenant_id"));
  const defaultLocale = normalizeString(formData.get("default_locale"));
  const enabled = normalizeBoolean(formData.get("enabled"));

  if (!tenantId || !defaultLocale) {
    throw new AdminTenantError("invalid_payload", 400, "tenant_id and default_locale are required.");
  }

  const domains = [
    ...formData
      .getAll("domains")
      .map((entry) => normalizeString(entry))
      .filter((entry): entry is string => entry !== null)
  ];

  const singleDomain = normalizeString(formData.get("domain"));
  if (singleDomain) {
    domains.push(singleDomain);
  }

  return {
    tenant_id: tenantId,
    default_locale: defaultLocale,
    enabled: enabled === null ? undefined : enabled,
    domains,
    csrfToken: readAdminCsrfTokenFromHeader(request) ?? readAdminCsrfTokenFromFormData(formData)
  };
};

const parseCreatePayload = async (request: Request): Promise<ParsedCreatePayload> => {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return parseCreatePayloadFromJson(request);
  }

  return parseCreatePayloadFromFormData(request);
};

const buildErrorResponse = (
  request: Request,
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

  const redirectUrl = buildRedirectUrl(request, "/admin/tenants");
  redirectUrl.searchParams.set("error", code);
  if (detail) {
    redirectUrl.searchParams.set("detail", detail);
  }

  return NextResponse.redirect(redirectUrl, 303);
};

const buildCreatedResponse = (
  request: Request,
  tenantId: string
): Response => {
  if (prefersJson(request)) {
    return NextResponse.json(
      {
        ok: true,
        tenant_id: tenantId
      },
      { status: 201 }
    );
  }

  const redirectUrl = buildRedirectUrl(request, `/admin/tenants/${encodeURIComponent(tenantId)}`);
  redirectUrl.searchParams.set("created", "ok");
  return NextResponse.redirect(redirectUrl, 303);
};

export const GET = async (): Promise<Response> => {
  const cookieStore = await cookies();
  const session = await verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const tenants = await listAdminTenantsWithCounts();
    return NextResponse.json(
      {
        source: getAdminTenantsSource(),
        tenants
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error({ error }, "app/api/admin/tenants/route.ts operation failed");
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
};

export const POST = async (request: Request): Promise<Response> => {
  const cookieStore = await cookies();
  const session = await verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return buildErrorResponse(request, "unauthorized", 401);
  }

  if (session.role !== "admin") {
    return buildErrorResponse(request, "forbidden", 403, "Only admin can modify tenants.");
  }

  let parsedPayload: ParsedCreatePayload;
  try {
    parsedPayload = await parseCreatePayload(request);
  } catch (error) {
    logger.error({ error, ...requestContext(request) }, "app/api/admin/tenants/route.ts operation failed");
    return buildErrorResponse(request, "invalid_payload", 400);
  }

  const csrfCookieToken = normalizeAdminCsrfToken(
    cookieStore.get(ADMIN_CSRF_COOKIE)?.value
  );
  if (!isAdminCsrfTokenValid(csrfCookieToken, parsedPayload.csrfToken)) {
    return buildErrorResponse(request, "invalid_csrf", 403);
  }

  try {
    const created = await createAdminTenant({
      tenant_id: parsedPayload.tenant_id,
      default_locale: parsedPayload.default_locale,
      enabled: parsedPayload.enabled,
      domains: parsedPayload.domains
    });

    void logAdminEvent({
      actor: session.role,
      action: "tenant_created",
      entity_type: "tenant",
      entity_id: created.tenant_id,
      metadata: {
        default_locale: created.default_locale,
        enabled: created.enabled,
        domains: created.domains
      }
    }).catch(() => undefined);

    return buildCreatedResponse(request, created.tenant_id);
  } catch (error) {
    if (error instanceof AdminTenantError) {
      return buildErrorResponse(request, error.code, error.status, error.detail);
    }

    return buildErrorResponse(request, "db_error", 500);
  }
};

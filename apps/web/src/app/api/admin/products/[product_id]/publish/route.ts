import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  ADMIN_CSRF_COOKIE,
  isAdminCsrfTokenValid,
  normalizeAdminCsrfToken,
  readAdminCsrfTokenFromFormData,
  readAdminCsrfTokenFromHeader,
  readAdminCsrfTokenFromJson
} from "../../../../../../lib/admin/csrf";
import { logAdminEvent } from "../../../../../../lib/admin/audit";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "../../../../../../lib/admin/session";
import {
  publishProductVersionToTenant,
  ProductRepoError
} from "../../../../../../lib/content_db/products_repo";
import { buildRedirectUrl } from "../../../../../../lib/security/redirect_base";

type RouteContext = {
  params: Promise<{ product_id: string }> | { product_id: string };
};

type ParsedRequest = {
  versionId: string;
  tenantId: string;
  isEnabled: boolean;
  csrfToken: string | null;
};

const resolveParams = async (
  params: RouteContext["params"]
): Promise<{ product_id: string }> => {
  return Promise.resolve(params);
};

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseBoolean = (value: unknown): boolean | null => {
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

const parseRequest = async (request: Request): Promise<ParsedRequest> => {
  const contentType = request.headers.get("content-type") ?? "";
  const headerCsrfToken = readAdminCsrfTokenFromHeader(request);

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as Record<string, unknown>;
    const versionId = normalizeString(body.version_id);
    const tenantId = normalizeString(body.tenant_id);
    const isEnabled = parseBoolean(body.is_enabled);
    if (!versionId || !tenantId || isEnabled === null) {
      throw new Error("invalid_payload");
    }

    return {
      versionId,
      tenantId,
      isEnabled,
      csrfToken: headerCsrfToken ?? readAdminCsrfTokenFromJson(body)
    };
  }

  const formData = await request.formData();
  const versionId = normalizeString(formData.get("version_id"));
  const tenantId = normalizeString(formData.get("tenant_id"));
  const isEnabled = parseBoolean(formData.get("is_enabled"));
  if (!versionId || !tenantId || isEnabled === null) {
    throw new Error("invalid_payload");
  }

  return {
    versionId,
    tenantId,
    isEnabled,
    csrfToken: headerCsrfToken ?? readAdminCsrfTokenFromFormData(formData)
  };
};

const buildErrorResponse = (
  request: Request,
  productId: string,
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

  const redirectUrl = buildRedirectUrl(
    request,
    `/admin/products/${encodeURIComponent(productId)}`
  );
  redirectUrl.searchParams.set("error", code);
  if (detail) {
    redirectUrl.searchParams.set("detail", detail);
  }
  return NextResponse.redirect(redirectUrl, 303);
};

const buildSuccessResponse = (request: Request, productId: string): Response => {
  if (prefersJson(request)) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const redirectUrl = buildRedirectUrl(
    request,
    `/admin/products/${encodeURIComponent(productId)}`
  );
  redirectUrl.searchParams.set("published", "ok");
  return NextResponse.redirect(redirectUrl, 303);
};

export const POST = async (
  request: Request,
  context: RouteContext
): Promise<Response> => {
  const { product_id: productId } = await resolveParams(context.params);

  const cookieStore = await cookies();
  const session = await verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return buildErrorResponse(request, productId, "unauthorized", 401);
  }

  if (session.role !== "admin") {
    return buildErrorResponse(
      request,
      productId,
      "forbidden",
      403,
      "Only admin can publish products."
    );
  }

  let parsed: ParsedRequest;
  try {
    parsed = await parseRequest(request);
  } catch {
    return buildErrorResponse(request, productId, "invalid_payload", 400);
  }

  const csrfCookieToken = normalizeAdminCsrfToken(cookieStore.get(ADMIN_CSRF_COOKIE)?.value);
  if (!isAdminCsrfTokenValid(csrfCookieToken, parsed.csrfToken)) {
    return buildErrorResponse(request, productId, "invalid_csrf", 403);
  }

  try {
    const result = await publishProductVersionToTenant({
      product_id: productId,
      version_id: parsed.versionId,
      tenant_id: parsed.tenantId,
      is_enabled: parsed.isEnabled
    });

    void Promise.resolve(
      logAdminEvent({
        actor: session.role,
        action: "product_published",
        entity_type: "product",
        entity_id: result.product_id,
        metadata: {
          content_type: "product",
          content_key: result.product_id,
          slug: result.slug,
          tenant_id: result.tenant_id,
          version_id: result.version_id,
          version: result.version,
          is_enabled: result.is_enabled
        }
      })
    ).catch(() => undefined);

    return buildSuccessResponse(request, result.product_id);
  } catch (error) {
    if (error instanceof ProductRepoError) {
      return buildErrorResponse(request, productId, error.code, error.status, error.detail);
    }

    return buildErrorResponse(request, productId, "db_error", 500);
  }
};

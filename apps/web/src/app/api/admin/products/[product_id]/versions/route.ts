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
  createProductDraftVersion,
  ProductRepoError
} from "../../../../../../lib/content_db/products_repo";
import { buildRedirectUrl } from "../../../../../../lib/security/redirect_base";

type RouteContext = {
  params: Promise<{ product_id: string }> | { product_id: string };
};

type ParsedRequest = {
  specJson: Record<string, unknown>;
  csrfToken: string | null;
};

const resolveParams = async (
  params: RouteContext["params"]
): Promise<{ product_id: string }> => {
  return Promise.resolve(params);
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
    if (!isObjectRecord(body.spec_json)) {
      throw new Error("invalid_spec_json");
    }

    return {
      specJson: body.spec_json,
      csrfToken: headerCsrfToken ?? readAdminCsrfTokenFromJson(body)
    };
  }

  const formData = await request.formData();
  const rawSpec = formData.get("spec_json");
  if (typeof rawSpec !== "string") {
    throw new Error("invalid_spec_json");
  }

  let parsedSpec: unknown;
  try {
    parsedSpec = JSON.parse(rawSpec);
  } catch {
    throw new Error("invalid_spec_json");
  }

  if (!isObjectRecord(parsedSpec)) {
    throw new Error("invalid_spec_json");
  }

  return {
    specJson: parsedSpec,
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
  redirectUrl.searchParams.set("version_created", "ok");
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
      "Only admin can create versions."
    );
  }

  let parsed: ParsedRequest;
  try {
    parsed = await parseRequest(request);
  } catch {
    return buildErrorResponse(request, productId, "invalid_spec_json", 400);
  }

  const csrfCookieToken = normalizeAdminCsrfToken(cookieStore.get(ADMIN_CSRF_COOKIE)?.value);
  if (!isAdminCsrfTokenValid(csrfCookieToken, parsed.csrfToken)) {
    return buildErrorResponse(request, productId, "invalid_csrf", 403);
  }

  try {
    const version = await createProductDraftVersion(productId, parsed.specJson, session.role);

    void Promise.resolve(
      logAdminEvent({
        actor: session.role,
        action: "product_version_created",
        entity_type: "product",
        entity_id: version.product_id,
        metadata: {
          product_id: version.product_id,
          version_id: version.version_id,
          version: version.version,
          status: version.status
        }
      })
    ).catch(() => undefined);

    return buildSuccessResponse(request, version.product_id);
  } catch (error) {
    if (error instanceof ProductRepoError) {
      return buildErrorResponse(request, productId, error.code, error.status, error.detail);
    }

    return buildErrorResponse(request, productId, "db_error", 500);
  }
};

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
import { createProduct, ProductRepoError } from "@/lib/content_db/products_repo";
import { buildRedirectUrl } from "@/lib/security/redirect_base";

type ParsedRequest = {
  slug: string;
  csrfToken: string | null;
};

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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
    const slug = normalizeString(body.slug);
    if (!slug) {
      throw new Error("invalid_payload");
    }

    return {
      slug,
      csrfToken: headerCsrfToken ?? readAdminCsrfTokenFromJson(body)
    };
  }

  const formData = await request.formData();
  const slug = normalizeString(formData.get("slug"));
  if (!slug) {
    throw new Error("invalid_payload");
  }

  return {
    slug,
    csrfToken: headerCsrfToken ?? readAdminCsrfTokenFromFormData(formData)
  };
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

  const redirectUrl = buildRedirectUrl(request, "/admin/products");
  redirectUrl.searchParams.set("error", code);
  if (detail) {
    redirectUrl.searchParams.set("detail", detail);
  }
  return NextResponse.redirect(redirectUrl, 303);
};

const buildSuccessResponse = (
  request: Request,
  payload: { product_id: string; slug: string }
): Response => {
  if (prefersJson(request)) {
    return NextResponse.json(
      {
        ok: true,
        result: payload
      },
      { status: 200 }
    );
  }

  const redirectUrl = buildRedirectUrl(
    request,
    `/admin/products/${encodeURIComponent(payload.product_id)}`
  );
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
    return buildErrorResponse(request, "forbidden", 403, "Only admin can create products.");
  }

  let parsed: ParsedRequest;
  try {
    parsed = await parseRequest(request);
  } catch {
    return buildErrorResponse(request, "invalid_slug", 400);
  }

  const csrfCookieToken = normalizeAdminCsrfToken(cookieStore.get(ADMIN_CSRF_COOKIE)?.value);
  if (!isAdminCsrfTokenValid(csrfCookieToken, parsed.csrfToken)) {
    return buildErrorResponse(request, "invalid_csrf", 403);
  }

  try {
    const product = await createProduct(parsed.slug);

    void Promise.resolve(
      logAdminEvent({
        actor: session.role,
        action: "product_created",
        entity_type: "product",
        entity_id: product.product_id,
        metadata: {
          product_id: product.product_id,
          slug: product.slug
        }
      })
    ).catch(() => undefined);

    return buildSuccessResponse(request, {
      product_id: product.product_id,
      slug: product.slug
    });
  } catch (error) {
    if (error instanceof ProductRepoError) {
      return buildErrorResponse(request, error.code, error.status, error.detail);
    }

    return buildErrorResponse(request, "db_error", 500);
  }
};

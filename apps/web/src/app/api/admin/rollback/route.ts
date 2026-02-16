import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  ADMIN_CSRF_COOKIE,
  isAdminCsrfTokenValid,
  normalizeAdminCsrfToken,
  readAdminCsrfTokenFromFormData,
  readAdminCsrfTokenFromHeader,
  readAdminCsrfTokenFromJson
} from "../../../../lib/admin/csrf";
import {
  ADMIN_PUBLISH_RATE_LIMIT,
  consumeAdminRateLimit
} from "../../../../lib/admin/rate_limit";
import {
  isPublishWorkflowError,
  rollbackVersionForTenant
} from "../../../../lib/admin/publish";
import {
  isPublishGuardrailValidationError,
  validateRollbackGuardrails
} from "../../../../lib/admin/publish_guardrails";
import { logAdminEvent } from "../../../../lib/admin/audit";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "../../../../lib/admin/session";
import { buildRedirectUrl } from "../../../../lib/security/redirect_base";

type RollbackPayload = {
  test_id: string;
  tenant_id: string;
  version_id: string;
};

type ParsedRequest = {
  payload: RollbackPayload;
  csrfToken: string | null;
};

type RequestErrorCode =
  | "unauthorized"
  | "forbidden"
  | "invalid_csrf"
  | "rate_limited"
  | "invalid_payload"
  | "rollback_failed";

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

const errorRedirect = (
  request: Request,
  code: string,
  detail?: string | null
): NextResponse => {
  const redirectUrl = buildRedirectUrl(request, "/admin");
  redirectUrl.searchParams.set("rollback_error", code);
  if (detail) {
    redirectUrl.searchParams.set("detail", detail);
  }
  return NextResponse.redirect(redirectUrl, 303);
};

const successRedirect = (request: Request): NextResponse => {
  const redirectUrl = buildRedirectUrl(request, "/admin");
  redirectUrl.searchParams.set("rollback", "ok");
  return NextResponse.redirect(redirectUrl, 303);
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

  return errorRedirect(request, code, detail);
};

const buildSuccessResponse = (request: Request, payload: Record<string, unknown>): Response => {
  if (prefersJson(request)) {
    return NextResponse.json(payload, { status: 200 });
  }

  return successRedirect(request);
};

const parsePayload = async (request: Request): Promise<ParsedRequest> => {
  const contentType = request.headers.get("content-type") ?? "";
  const headerCsrfToken = readAdminCsrfTokenFromHeader(request);

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as Record<string, unknown>;
    const testId = normalizeString(body.test_id);
    const tenantId = normalizeString(body.tenant_id);
    const versionId = normalizeString(body.version_id);

    if (!testId || !tenantId || !versionId) {
      throw new Error("invalid_payload");
    }

    return {
      payload: {
        test_id: testId,
        tenant_id: tenantId,
        version_id: versionId
      },
      csrfToken: headerCsrfToken ?? readAdminCsrfTokenFromJson(body)
    };
  }

  const formData = await request.formData();
  const testId = normalizeString(formData.get("test_id"));
  const tenantId = normalizeString(formData.get("tenant_id"));
  const versionId = normalizeString(formData.get("version_id"));

  if (!testId || !tenantId || !versionId) {
    throw new Error("invalid_payload");
  }

  return {
    payload: {
      test_id: testId,
      tenant_id: tenantId,
      version_id: versionId
    },
    csrfToken: headerCsrfToken ?? readAdminCsrfTokenFromFormData(formData)
  };
};

const handleRequestError = (
  request: Request,
  code: RequestErrorCode,
  status: number,
  detail?: string | null
): Response => {
  return buildErrorResponse(request, code, status, detail);
};

export const POST = async (request: Request): Promise<Response> => {
  const cookieStore = await cookies();
  const session = await verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return handleRequestError(request, "unauthorized", 401);
  }

  if (session.role !== "admin") {
    return handleRequestError(request, "forbidden", 403, "Only admin can rollback.");
  }

  let parsedRequest: ParsedRequest;
  try {
    parsedRequest = await parsePayload(request);
  } catch {
    return handleRequestError(request, "invalid_payload", 400);
  }

  const csrfCookieToken = normalizeAdminCsrfToken(
    cookieStore.get(ADMIN_CSRF_COOKIE)?.value
  );
  if (!isAdminCsrfTokenValid(csrfCookieToken, parsedRequest.csrfToken)) {
    return handleRequestError(request, "invalid_csrf", 403);
  }

  const rateLimitResult = consumeAdminRateLimit(request, "admin-rollback", ADMIN_PUBLISH_RATE_LIMIT);
  if (rateLimitResult.limited) {
    return handleRequestError(
      request,
      "rate_limited",
      429,
      rateLimitResult.retryAfterSeconds ? String(rateLimitResult.retryAfterSeconds) : null
    );
  }

  try {
    await validateRollbackGuardrails({
      test_id: parsedRequest.payload.test_id,
      version_id: parsedRequest.payload.version_id,
      tenant_id: parsedRequest.payload.tenant_id
    });
  } catch (error) {
    if (isPublishGuardrailValidationError(error)) {
      return handleRequestError(request, "invalid_payload", 400, error.message);
    }

    return handleRequestError(request, "rollback_failed", 500);
  }

  try {
    const updated = await rollbackVersionForTenant({
      actor_role: session.role,
      test_id: parsedRequest.payload.test_id,
      tenant_id: parsedRequest.payload.tenant_id,
      version_id: parsedRequest.payload.version_id
    });

    await logAdminEvent({
      actor: session.role,
      action: "test_rollback",
      entity_type: "test",
      entity_id: updated.test_id,
      metadata: {
        tenant_id: parsedRequest.payload.tenant_id,
        version_id: updated.version_id,
        version: updated.version
      }
    });

    return buildSuccessResponse(request, {
      ok: true,
      result: updated
    });
  } catch (error) {
    if (isPublishWorkflowError(error)) {
      return buildErrorResponse(request, error.code, error.status, error.detail);
    }

    return handleRequestError(request, "rollback_failed", 500);
  }
};

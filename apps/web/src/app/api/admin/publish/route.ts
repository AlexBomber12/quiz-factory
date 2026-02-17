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
  publishVersionToTenants
} from "../../../../lib/admin/publish";
import {
  isPublishGuardrailValidationError,
  validatePublishGuardrails
} from "../../../../lib/admin/publish_guardrails";
import { logAdminEvent } from "../../../../lib/admin/audit";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "../../../../lib/admin/session";
import { buildRedirectUrl } from "../../../../lib/security/redirect_base";

type PublishPayload = {
  test_id: string;
  version_id: string;
  tenant_ids: string[];
  is_enabled: boolean;
};

type ParsedRequest = {
  payload: PublishPayload;
  csrfToken: string | null;
};

type RequestErrorCode =
  | "unauthorized"
  | "forbidden"
  | "invalid_csrf"
  | "rate_limited"
  | "invalid_payload"
  | "publish_failed";

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

const parseStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeString(entry))
      .filter((entry): entry is string => entry !== null);
  }

  const single = normalizeString(value);
  return single ? [single] : [];
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
  redirectUrl.searchParams.set("publish_error", code);
  if (detail) {
    redirectUrl.searchParams.set("detail", detail);
  }
  return NextResponse.redirect(redirectUrl, 303);
};

const successRedirect = (request: Request): NextResponse => {
  const redirectUrl = buildRedirectUrl(request, "/admin");
  redirectUrl.searchParams.set("publish", "ok");
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
    const versionId = normalizeString(body.version_id);
    const tenantIds = parseStringArray(body.tenant_ids);
    const isEnabled = parseBoolean(body.is_enabled);

    if (!testId || !versionId || tenantIds.length === 0 || isEnabled === null) {
      throw new Error("invalid_payload");
    }

    return {
      payload: {
        test_id: testId,
        version_id: versionId,
        tenant_ids: tenantIds,
        is_enabled: isEnabled
      },
      csrfToken: headerCsrfToken ?? readAdminCsrfTokenFromJson(body)
    };
  }

  const formData = await request.formData();
  const testId = normalizeString(formData.get("test_id"));
  const versionId = normalizeString(formData.get("version_id"));
  const tenantIds = parseStringArray(formData.getAll("tenant_ids"));
  const isEnabled = parseBoolean(formData.get("is_enabled"));

  if (!testId || !versionId || tenantIds.length === 0 || isEnabled === null) {
    throw new Error("invalid_payload");
  }

  return {
    payload: {
      test_id: testId,
      version_id: versionId,
      tenant_ids: tenantIds,
      is_enabled: isEnabled
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
    return handleRequestError(request, "forbidden", 403, "Only admin can publish.");
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

  const rateLimitResult = consumeAdminRateLimit(request, "admin-publish", ADMIN_PUBLISH_RATE_LIMIT);
  if (rateLimitResult.limited) {
    return handleRequestError(
      request,
      "rate_limited",
      429,
      rateLimitResult.retryAfterSeconds ? String(rateLimitResult.retryAfterSeconds) : null
    );
  }

  try {
    await validatePublishGuardrails({
      test_id: parsedRequest.payload.test_id,
      version_id: parsedRequest.payload.version_id,
      tenant_ids: parsedRequest.payload.tenant_ids,
      is_enabled: parsedRequest.payload.is_enabled
    });
  } catch (error) {
    if (isPublishGuardrailValidationError(error)) {
      return handleRequestError(request, "invalid_payload", 400, error.message);
    }

    return handleRequestError(request, "publish_failed", 500);
  }

  try {
    const updated = await publishVersionToTenants({
      actor_role: session.role,
      test_id: parsedRequest.payload.test_id,
      version_id: parsedRequest.payload.version_id,
      tenant_ids: parsedRequest.payload.tenant_ids,
      is_enabled: parsedRequest.payload.is_enabled
    });

    void Promise.resolve(
      logAdminEvent({
        actor: session.role,
        action: "test_published",
        entity_type: "test",
        entity_id: updated.test_id,
        metadata: {
          content_type: "test",
          content_key: updated.test_id,
          version_id: updated.version_id,
          version: updated.version,
          tenant_ids: updated.tenant_ids,
          is_enabled: updated.is_enabled
        }
      })
    ).catch(() => undefined);

    return buildSuccessResponse(request, {
      ok: true,
      result: updated
    });
  } catch (error) {
    if (isPublishWorkflowError(error)) {
      return buildErrorResponse(request, error.code, error.status, error.detail);
    }

    return handleRequestError(request, "publish_failed", 500);
  }
};

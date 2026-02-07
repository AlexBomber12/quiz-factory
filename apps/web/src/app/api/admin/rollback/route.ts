import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  isPublishWorkflowError,
  rollbackVersionForTenant
} from "../../../../lib/admin/publish";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "../../../../lib/admin/session";

type RollbackPayload = {
  test_id: string;
  tenant_id: string;
  version_id: string;
};

type RequestErrorCode = "unauthorized" | "forbidden" | "invalid_payload" | "rollback_failed";

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
  const redirectUrl = new URL("/admin", request.url);
  redirectUrl.searchParams.set("rollback_error", code);
  if (detail) {
    redirectUrl.searchParams.set("detail", detail);
  }
  return NextResponse.redirect(redirectUrl, 303);
};

const successRedirect = (request: Request): NextResponse => {
  const redirectUrl = new URL("/admin", request.url);
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

const parsePayload = async (request: Request): Promise<RollbackPayload> => {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as Record<string, unknown>;
    const testId = normalizeString(body.test_id);
    const tenantId = normalizeString(body.tenant_id);
    const versionId = normalizeString(body.version_id);

    if (!testId || !tenantId || !versionId) {
      throw new Error("invalid_payload");
    }

    return {
      test_id: testId,
      tenant_id: tenantId,
      version_id: versionId
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
    test_id: testId,
    tenant_id: tenantId,
    version_id: versionId
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

  let payload: RollbackPayload;
  try {
    payload = await parsePayload(request);
  } catch {
    return handleRequestError(request, "invalid_payload", 400);
  }

  try {
    const updated = await rollbackVersionForTenant({
      actor_role: session.role,
      test_id: payload.test_id,
      tenant_id: payload.tenant_id,
      version_id: payload.version_id
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

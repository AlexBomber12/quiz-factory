import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  isPublishWorkflowError,
  publishVersionToTenants
} from "../../../../lib/admin/publish";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "../../../../lib/admin/session";

type PublishPayload = {
  test_id: string;
  version_id: string;
  tenant_ids: string[];
  is_enabled: boolean;
};

type RequestErrorCode = "unauthorized" | "forbidden" | "invalid_payload" | "publish_failed";

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
  const redirectUrl = new URL("/admin", request.url);
  redirectUrl.searchParams.set("publish_error", code);
  if (detail) {
    redirectUrl.searchParams.set("detail", detail);
  }
  return NextResponse.redirect(redirectUrl, 303);
};

const successRedirect = (request: Request): NextResponse => {
  const redirectUrl = new URL("/admin", request.url);
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

const parsePayload = async (request: Request): Promise<PublishPayload> => {
  const contentType = request.headers.get("content-type") ?? "";

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
      test_id: testId,
      version_id: versionId,
      tenant_ids: tenantIds,
      is_enabled: isEnabled
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
    test_id: testId,
    version_id: versionId,
    tenant_ids: tenantIds,
    is_enabled: isEnabled
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

  let payload: PublishPayload;
  try {
    payload = await parsePayload(request);
  } catch {
    return handleRequestError(request, "invalid_payload", 400);
  }

  try {
    const updated = await publishVersionToTenants({
      actor_role: session.role,
      test_id: payload.test_id,
      version_id: payload.version_id,
      tenant_ids: payload.tenant_ids,
      is_enabled: payload.is_enabled
    });

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

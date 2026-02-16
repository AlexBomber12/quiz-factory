import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  ADMIN_CSRF_COOKIE,
  isAdminCsrfTokenValid,
  normalizeAdminCsrfToken,
  readAdminCsrfTokenFromHeader,
  readAdminCsrfTokenFromJson,
  readAdminCsrfTokenFromFormData
} from "../../../../lib/admin/csrf";
import {
  ADMIN_SESSION_COOKIE,
  issueAdminSession,
  resolveAdminRoleFromToken
} from "../../../../lib/admin/session";
import { logAdminEvent } from "../../../../lib/admin/audit";
import { buildRedirectUrl } from "../../../../lib/security/redirect_base";
import { resolveTenant } from "../../../../lib/tenants/resolve";

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const buildLoginRedirect = (request: Request, error?: string): URL => {
  const loginUrl = buildRedirectUrl(request, "/admin/login");
  if (error) {
    loginUrl.searchParams.set("error", error);
  }
  return loginUrl;
};

const parseTokenAndCsrf = async (
  request: Request
): Promise<{ token: string | null; csrfToken: string | null }> => {
  const headerCsrfToken = readAdminCsrfTokenFromHeader(request);
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return { token: null, csrfToken: headerCsrfToken };
    }
    if (!body || typeof body !== "object") {
      return { token: null, csrfToken: headerCsrfToken };
    }
    const record = body as Record<string, unknown>;
    const token = normalizeString(record.token);
    const bodyCsrfToken = readAdminCsrfTokenFromJson(record);
    return {
      token,
      csrfToken: headerCsrfToken ?? bodyCsrfToken
    };
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return {
      token: null,
      csrfToken: headerCsrfToken
    };
  }

  const token = normalizeString(formData.get("token"));
  const bodyCsrfToken = readAdminCsrfTokenFromFormData(formData);
  return {
    token,
    csrfToken: headerCsrfToken ?? bodyCsrfToken
  };
};

export const POST = async (request: Request): Promise<Response> => {
  const parsed = await parseTokenAndCsrf(request);
  const token = parsed.token;
  if (!token) {
    return NextResponse.redirect(buildLoginRedirect(request, "missing_token"), 303);
  }

  const cookieStore = await cookies();
  const csrfCookieToken = normalizeAdminCsrfToken(
    cookieStore.get(ADMIN_CSRF_COOKIE)?.value
  );
  if (!isAdminCsrfTokenValid(csrfCookieToken, parsed.csrfToken)) {
    return NextResponse.redirect(buildLoginRedirect(request, "invalid_csrf"), 303);
  }

  const role = resolveAdminRoleFromToken(token);
  if (!role) {
    return NextResponse.redirect(buildLoginRedirect(request, "invalid_token"), 303);
  }

  let session: Awaited<ReturnType<typeof issueAdminSession>>;
  try {
    session = await issueAdminSession(role);
  } catch {
    return NextResponse.redirect(buildLoginRedirect(request, "server_misconfigured"), 303);
  }

  const requestUrl = new URL(request.url);
  const tenantResolution = resolveTenant(request.headers, requestUrl.hostname);

  const response = NextResponse.redirect(buildRedirectUrl(request, "/admin"), 303);
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: session.cookieValue,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: session.expiresAt
  });

  void logAdminEvent({
    actor: role,
    action: "admin_login",
    entity_type: "tenant",
    entity_id: tenantResolution.tenantId,
    metadata: {
      host: requestUrl.hostname
    }
  }).catch(() => undefined);

  return response;
};

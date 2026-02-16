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
import { logAdminEvent } from "../../../../lib/admin/audit";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "../../../../lib/admin/session";
import { buildRedirectUrl } from "../../../../lib/security/redirect_base";
import { resolveTenant } from "../../../../lib/tenants/resolve";

const parseCsrfToken = async (request: Request): Promise<string | null> => {
  const headerToken = readAdminCsrfTokenFromHeader(request);
  if (headerToken) {
    return headerToken;
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const body = (await request.json()) as Record<string, unknown>;
      return readAdminCsrfTokenFromJson(body);
    } catch {
      return null;
    }
  }

  try {
    const formData = await request.formData();
    return readAdminCsrfTokenFromFormData(formData);
  } catch {
    return null;
  }
};

export const POST = async (request: Request): Promise<Response> => {
  const cookieStore = await cookies();
  const session = await verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  const csrfCookieToken = normalizeAdminCsrfToken(
    cookieStore.get(ADMIN_CSRF_COOKIE)?.value
  );
  const csrfToken = await parseCsrfToken(request);
  if (!isAdminCsrfTokenValid(csrfCookieToken, csrfToken)) {
    const invalidCsrfRedirect = buildRedirectUrl(request, "/admin/login");
    invalidCsrfRedirect.searchParams.set("error", "invalid_csrf");
    return NextResponse.redirect(invalidCsrfRedirect, 303);
  }

  const response = NextResponse.redirect(buildRedirectUrl(request, "/admin/login"), 303);
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });

  if (session) {
    const requestUrl = new URL(request.url);
    const tenantResolution = resolveTenant(request.headers, requestUrl.hostname);

    await logAdminEvent({
      actor: session.role,
      action: "admin_logout",
      entity_type: "tenant",
      entity_id: tenantResolution.tenantId,
      metadata: {
        host: requestUrl.hostname
      }
    });
  }

  return response;
};

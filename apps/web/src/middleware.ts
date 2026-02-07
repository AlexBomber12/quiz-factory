import { NextRequest, NextResponse } from "next/server";

import {
  ADMIN_CSRF_BOOTSTRAP_HEADER,
  ADMIN_CSRF_COOKIE,
  createAdminCsrfToken,
  normalizeAdminCsrfToken
} from "./lib/admin/csrf";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "./lib/admin/session";

const ADMIN_LOGIN_PATH = "/admin/login";
const ADMIN_API_LOGIN_PATH = "/api/admin/login";

const isProtectedAdminPagePath = (pathname: string): boolean => {
  if (pathname === ADMIN_LOGIN_PATH) {
    return false;
  }

  return pathname === "/admin" || pathname.startsWith("/admin/");
};

const isProtectedAdminApiPath = (pathname: string): boolean => {
  if (pathname === ADMIN_API_LOGIN_PATH) {
    return false;
  }

  return pathname === "/api/admin" || pathname.startsWith("/api/admin/");
};

const isAuthenticated = async (request: NextRequest): Promise<boolean> => {
  const value = request.cookies.get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const session = await verifyAdminSession(value);
  return session !== null;
};

const unauthorizedApiResponse = (): NextResponse => {
  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
};

const unauthorizedAdminPageResponse = (request: NextRequest): NextResponse => {
  const url = request.nextUrl.clone();
  url.pathname = ADMIN_LOGIN_PATH;
  url.search = "";
  return NextResponse.redirect(url);
};

const resolveAdminCsrfToken = (
  request: NextRequest
): { token: string; shouldSetCookie: boolean } => {
  const existing = normalizeAdminCsrfToken(
    request.cookies.get(ADMIN_CSRF_COOKIE)?.value
  );
  if (existing) {
    return { token: existing, shouldSetCookie: false };
  }

  return { token: createAdminCsrfToken(), shouldSetCookie: true };
};

const withAdminCsrfCookie = (
  response: NextResponse,
  token: string,
  shouldSetCookie: boolean
): NextResponse => {
  if (!shouldSetCookie) {
    return response;
  }

  response.cookies.set({
    name: ADMIN_CSRF_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  });

  return response;
};

const nextWithAdminCsrf = (
  request: NextRequest,
  token: string,
  shouldSetCookie: boolean
): NextResponse => {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(ADMIN_CSRF_BOOTSTRAP_HEADER, token);
  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
  return withAdminCsrfCookie(response, token, shouldSetCookie);
};

export const middleware = async (request: NextRequest): Promise<Response> => {
  const csrf = resolveAdminCsrfToken(request);
  const pathname = request.nextUrl.pathname;
  const protectAdminPage = isProtectedAdminPagePath(pathname);
  const protectAdminApi = isProtectedAdminApiPath(pathname);
  if (!protectAdminPage && !protectAdminApi) {
    return nextWithAdminCsrf(request, csrf.token, csrf.shouldSetCookie);
  }

  if (await isAuthenticated(request)) {
    return nextWithAdminCsrf(request, csrf.token, csrf.shouldSetCookie);
  }

  if (protectAdminApi) {
    return withAdminCsrfCookie(
      unauthorizedApiResponse(),
      csrf.token,
      csrf.shouldSetCookie
    );
  }

  return withAdminCsrfCookie(
    unauthorizedAdminPageResponse(request),
    csrf.token,
    csrf.shouldSetCookie
  );
};

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"]
};

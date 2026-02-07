import { NextRequest, NextResponse } from "next/server";

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

export const middleware = async (request: NextRequest): Promise<Response> => {
  const pathname = request.nextUrl.pathname;
  const protectAdminPage = isProtectedAdminPagePath(pathname);
  const protectAdminApi = isProtectedAdminApiPath(pathname);
  if (!protectAdminPage && !protectAdminApi) {
    return NextResponse.next();
  }

  if (await isAuthenticated(request)) {
    return NextResponse.next();
  }

  if (protectAdminApi) {
    return unauthorizedApiResponse();
  }

  return unauthorizedAdminPageResponse(request);
};

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"]
};

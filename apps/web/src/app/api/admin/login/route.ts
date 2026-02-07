import { NextResponse } from "next/server";

import {
  ADMIN_SESSION_COOKIE,
  issueAdminSession,
  resolveAdminRoleFromToken
} from "../../../../lib/admin/session";

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const buildLoginRedirect = (request: Request, error?: string): URL => {
  const loginUrl = new URL("/admin/login", request.url);
  if (error) {
    loginUrl.searchParams.set("error", error);
  }
  return loginUrl;
};

const parseToken = async (request: Request): Promise<string | null> => {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return null;
    }
    if (!body || typeof body !== "object") {
      return null;
    }
    const token = (body as Record<string, unknown>).token;
    return normalizeString(token);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return null;
  }

  return normalizeString(formData.get("token"));
};

export const POST = async (request: Request): Promise<Response> => {
  const token = await parseToken(request);
  if (!token) {
    return NextResponse.redirect(buildLoginRedirect(request, "missing_token"), 303);
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

  const response = NextResponse.redirect(new URL("/admin", request.url), 303);
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: session.cookieValue,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: session.expiresAt
  });

  return response;
};

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  ADMIN_CSRF_COOKIE,
  isAdminCsrfTokenValid,
  normalizeAdminCsrfToken,
  readAdminCsrfTokenFromFormData,
  readAdminCsrfTokenFromHeader,
  readAdminCsrfTokenFromJson
} from "../../../../../lib/admin/csrf";
import {
  ImportConversionError,
  buildImportPreview,
  convertImportToDraft,
  getDraftByImportId,
  getImportById,
  isValidImportId
} from "../../../../../lib/admin/imports";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "../../../../../lib/admin/session";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

const resolveParams = async (params: RouteContext["params"]): Promise<{ id: string }> => {
  return Promise.resolve(params);
};

const prefersJson = (request: Request): boolean => {
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("application/json");
};

const buildRedirectResponse = (
  request: Request,
  importId: string,
  params: Record<string, string>
): NextResponse => {
  const redirectUrl = new URL(`/admin/imports/${importId}`, request.url);
  for (const [key, value] of Object.entries(params)) {
    redirectUrl.searchParams.set(key, value);
  }
  return NextResponse.redirect(redirectUrl, 303);
};

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

export const GET = async (_request: Request, context: RouteContext): Promise<Response> => {
  const cookieStore = await cookies();
  const session = await verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await resolveParams(context.params);
  if (!isValidImportId(id)) {
    return NextResponse.json({ error: "invalid_import_id" }, { status: 400 });
  }

  const record = await getImportById(id);
  if (!record) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const preview = buildImportPreview(record.files_json);
  const draft = await getDraftByImportId(id);

  return NextResponse.json({
    import: record,
    preview,
    draft
  });
};

export const POST = async (request: Request, context: RouteContext): Promise<Response> => {
  const cookieStore = await cookies();
  const session = await verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  const { id } = await resolveParams(context.params);
  if (!session) {
    if (prefersJson(request)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    return buildRedirectResponse(request, id, { error: "unauthorized" });
  }

  const csrfCookieToken = normalizeAdminCsrfToken(
    cookieStore.get(ADMIN_CSRF_COOKIE)?.value
  );
  const csrfToken = await parseCsrfToken(request);
  if (!isAdminCsrfTokenValid(csrfCookieToken, csrfToken)) {
    if (prefersJson(request)) {
      return NextResponse.json({ error: "invalid_csrf" }, { status: 403 });
    }

    return buildRedirectResponse(request, id, { error: "invalid_csrf" });
  }

  if (!isValidImportId(id)) {
    if (prefersJson(request)) {
      return NextResponse.json({ error: "invalid_import_id" }, { status: 400 });
    }

    return buildRedirectResponse(request, id, { error: "invalid_import_id" });
  }

  try {
    const converted = await convertImportToDraft({
      import_id: id,
      created_by: session.role
    });

    if (prefersJson(request)) {
      return NextResponse.json(
        {
          import: converted.import,
          draft: converted.draft,
          created: converted.created
        },
        { status: 200 }
      );
    }

    return buildRedirectResponse(request, id, {
      convert: converted.created ? "created" : "reused",
      version: String(converted.draft.version)
    });
  } catch (error) {
    if (error instanceof ImportConversionError) {
      if (prefersJson(request)) {
        return NextResponse.json(
          {
            error: error.code,
            detail: error.detail ?? null
          },
          { status: error.status }
        );
      }

      const params: Record<string, string> = {
        error: error.code
      };
      if (error.detail) {
        params.detail = error.detail;
      }
      return buildRedirectResponse(request, id, params);
    }

    if (prefersJson(request)) {
      return NextResponse.json(
        {
          error: "conversion_failed"
        },
        { status: 500 }
      );
    }

    return buildRedirectResponse(request, id, { error: "conversion_failed" });
  }
};

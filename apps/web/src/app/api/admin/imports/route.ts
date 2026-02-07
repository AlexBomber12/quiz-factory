import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  MAX_IMPORT_FILES,
  MAX_IMPORT_TOTAL_BYTES,
  type ImportFilesJson,
  createUploadedImport,
  hashMarkdown,
  isImportLocaleAllowed,
  parseImportLocaleFromFilename
} from "../../../../lib/admin/imports";
import {
  ADMIN_CSRF_COOKIE,
  isAdminCsrfTokenValid,
  normalizeAdminCsrfToken,
  readAdminCsrfTokenFromFormData,
  readAdminCsrfTokenFromHeader
} from "../../../../lib/admin/csrf";
import {
  ADMIN_UPLOAD_RATE_LIMIT,
  consumeAdminRateLimit
} from "../../../../lib/admin/rate_limit";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "../../../../lib/admin/session";

type UploadErrorCode =
  | "unauthorized"
  | "invalid_csrf"
  | "rate_limited"
  | "invalid_form_data"
  | "missing_files"
  | "too_many_files"
  | "invalid_file_type"
  | "invalid_filename"
  | "locale_not_allowed"
  | "duplicate_locale"
  | "total_bytes_exceeded"
  | "db_error";

class ImportUploadError extends Error {
  code: UploadErrorCode;
  status: number;
  detail: string | null;

  constructor(code: UploadErrorCode, status: number, detail?: string | null) {
    super(code);
    this.code = code;
    this.status = status;
    this.detail = detail ?? null;
  }
}

const prefersJson = (request: Request): boolean => {
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("application/json");
};

const buildErrorResponse = (
  request: Request,
  code: UploadErrorCode,
  status: number,
  detail?: string | null
): NextResponse => {
  if (prefersJson(request)) {
    return NextResponse.json({ error: code, detail: detail ?? null }, { status });
  }

  const redirectUrl = new URL("/admin/imports/new", request.url);
  redirectUrl.searchParams.set("error", code);
  if (detail) {
    redirectUrl.searchParams.set("detail", detail);
  }
  return NextResponse.redirect(redirectUrl, 303);
};

const parseUploadForm = async (
  request: Request
): Promise<{ csrfToken: string | null; uploadFiles: File[] }> => {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    throw new ImportUploadError("invalid_form_data", 400);
  }

  const uploadFiles: File[] = [];
  for (const value of formData.values()) {
    if (value instanceof File && value.size > 0) {
      uploadFiles.push(value);
    }
  }

  if (uploadFiles.length === 0) {
    throw new ImportUploadError("missing_files", 400);
  }

  if (uploadFiles.length > MAX_IMPORT_FILES) {
    throw new ImportUploadError("too_many_files", 400, `${MAX_IMPORT_FILES}`);
  }

  return {
    csrfToken: readAdminCsrfTokenFromHeader(request) ?? readAdminCsrfTokenFromFormData(formData),
    uploadFiles
  };
};

const buildUploadFilesJson = async (uploadFiles: File[]): Promise<ImportFilesJson> => {
  let totalBytes = 0;
  const filesJson: ImportFilesJson = {};

  for (const file of uploadFiles) {
    if (!file.name.toLowerCase().endsWith(".md")) {
      throw new ImportUploadError("invalid_file_type", 400, file.name);
    }

    const locale = parseImportLocaleFromFilename(file.name);
    if (!locale) {
      throw new ImportUploadError("invalid_filename", 400, file.name);
    }

    if (!isImportLocaleAllowed(locale)) {
      throw new ImportUploadError("locale_not_allowed", 400, locale);
    }

    if (filesJson[locale]) {
      throw new ImportUploadError("duplicate_locale", 400, locale);
    }

    totalBytes += file.size;
    if (totalBytes > MAX_IMPORT_TOTAL_BYTES) {
      throw new ImportUploadError("total_bytes_exceeded", 400, `${MAX_IMPORT_TOTAL_BYTES}`);
    }

    const md = await file.text();
    filesJson[locale] = {
      filename: file.name,
      md,
      sha256: hashMarkdown(md)
    };
  }

  return filesJson;
};

export const POST = async (request: Request): Promise<Response> => {
  const cookieStore = await cookies();
  const session = await verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return buildErrorResponse(request, "unauthorized", 401);
  }

  let parsedUpload: { csrfToken: string | null; uploadFiles: File[] };
  try {
    parsedUpload = await parseUploadForm(request);
  } catch (error) {
    if (error instanceof ImportUploadError) {
      return buildErrorResponse(request, error.code, error.status, error.detail);
    }

    return buildErrorResponse(request, "invalid_form_data", 400);
  }

  const csrfCookieToken = normalizeAdminCsrfToken(
    cookieStore.get(ADMIN_CSRF_COOKIE)?.value
  );
  if (!isAdminCsrfTokenValid(csrfCookieToken, parsedUpload.csrfToken)) {
    return buildErrorResponse(request, "invalid_csrf", 403);
  }

  const rateLimitResult = consumeAdminRateLimit(request, "admin-upload", ADMIN_UPLOAD_RATE_LIMIT);
  if (rateLimitResult.limited) {
    return buildErrorResponse(
      request,
      "rate_limited",
      429,
      rateLimitResult.retryAfterSeconds ? String(rateLimitResult.retryAfterSeconds) : null
    );
  }

  let filesJson: ImportFilesJson;
  try {
    filesJson = await buildUploadFilesJson(parsedUpload.uploadFiles);
  } catch (error) {
    if (error instanceof ImportUploadError) {
      return buildErrorResponse(request, error.code, error.status, error.detail);
    }

    return buildErrorResponse(request, "invalid_form_data", 400);
  }

  try {
    const created = await createUploadedImport({
      files_json: filesJson,
      created_by: session.role
    });

    if (prefersJson(request)) {
      return NextResponse.json(
        {
          id: created.id,
          status: created.status
        },
        { status: 201 }
      );
    }

    return NextResponse.redirect(new URL(`/admin/imports/${created.id}`, request.url), 303);
  } catch {
    return buildErrorResponse(request, "db_error", 500);
  }
};

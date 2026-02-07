export const ADMIN_CSRF_COOKIE = "admin_csrf";
export const ADMIN_CSRF_FORM_FIELD = "csrf_token";
export const ADMIN_CSRF_HEADER = "x-admin-csrf-token";
export const ADMIN_CSRF_BOOTSTRAP_HEADER = "x-admin-csrf-bootstrap";

const CSRF_TOKEN_RE = /^[A-Za-z0-9._-]{20,200}$/;

export const normalizeAdminCsrfToken = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || !CSRF_TOKEN_RE.test(trimmed)) {
    return null;
  }

  return trimmed;
};

export const createAdminCsrfToken = (): string => {
  return crypto.randomUUID();
};

export const readAdminCsrfTokenFromHeader = (request: Request): string | null => {
  return normalizeAdminCsrfToken(request.headers.get(ADMIN_CSRF_HEADER));
};

export const readAdminCsrfTokenFromFormData = (formData: FormData): string | null => {
  return normalizeAdminCsrfToken(formData.get(ADMIN_CSRF_FORM_FIELD));
};

export const readAdminCsrfTokenFromJson = (
  body: Record<string, unknown>
): string | null => {
  return normalizeAdminCsrfToken(body[ADMIN_CSRF_FORM_FIELD]);
};

export const isAdminCsrfTokenValid = (
  cookieToken: string | null,
  providedToken: string | null
): boolean => {
  if (!cookieToken || !providedToken) {
    return false;
  }

  return cookieToken === providedToken;
};

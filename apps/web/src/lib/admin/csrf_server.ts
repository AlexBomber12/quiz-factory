import { cookies, headers } from "next/headers";

import {
  ADMIN_CSRF_BOOTSTRAP_HEADER,
  ADMIN_CSRF_COOKIE,
  normalizeAdminCsrfToken
} from "./csrf";

export const getAdminCsrfTokenForRender = async (): Promise<string> => {
  const cookieStore = await cookies();
  const cookieToken = normalizeAdminCsrfToken(
    cookieStore.get(ADMIN_CSRF_COOKIE)?.value
  );
  if (cookieToken) {
    return cookieToken;
  }

  const headerStore = await headers();
  const bootstrapToken = normalizeAdminCsrfToken(
    headerStore.get(ADMIN_CSRF_BOOTSTRAP_HEADER)
  );

  return bootstrapToken ?? "";
};

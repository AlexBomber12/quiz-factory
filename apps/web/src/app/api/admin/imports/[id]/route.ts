import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  buildImportPreview,
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
  return NextResponse.json({
    import: record,
    preview
  });
};

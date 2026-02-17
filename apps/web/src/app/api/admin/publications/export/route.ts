import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { listAdminPublications } from "../../../../../lib/admin/publications";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "../../../../../lib/admin/session";

const TRUE_BOOLEAN_VALUES = new Set(["1", "true", "yes", "on"]);

const parseBooleanFilter = (value: string | null): boolean => {
  if (!value) {
    return false;
  }

  return TRUE_BOOLEAN_VALUES.has(value.trim().toLowerCase());
};

const escapeCsvCell = (value: string): string => {
  if (!/[",\r\n]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, "\"\"")}"`;
};

const toCsvValue = (value: string | null): string => {
  return escapeCsvCell(value ?? "");
};

const buildCsv = (
  rows: Awaited<ReturnType<typeof listAdminPublications>>
): string => {
  const lines = [
    [
      "tenant_id",
      "domains",
      "content_type",
      "content_key",
      "slug",
      "published_version_id",
      "is_enabled",
      "updated_at"
    ].join(",")
  ];

  for (const row of rows) {
    lines.push(
      [
        toCsvValue(row.tenant_id),
        toCsvValue(row.domains.join("|")),
        toCsvValue(row.content_type),
        toCsvValue(row.content_key),
        toCsvValue(row.slug),
        toCsvValue(row.published_version_id),
        toCsvValue(String(row.is_enabled)),
        toCsvValue(row.updated_at)
      ].join(",")
    );
  }

  return `${lines.join("\n")}\n`;
};

export const GET = async (request: Request): Promise<Response> => {
  const cookieStore = await cookies();
  const session = await verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json(
      {
        error: "unauthorized"
      },
      { status: 401 }
    );
  }

  const requestUrl = new URL(request.url);
  const filters = {
    q: requestUrl.searchParams.get("q"),
    tenant_id: requestUrl.searchParams.get("tenant_id"),
    content_type: requestUrl.searchParams.get("content_type"),
    content_key: requestUrl.searchParams.get("content_key"),
    test_id: requestUrl.searchParams.get("test_id"),
    only_published: parseBooleanFilter(requestUrl.searchParams.get("only_published")),
    only_enabled: parseBooleanFilter(requestUrl.searchParams.get("only_enabled"))
  };

  try {
    const rows = await listAdminPublications(filters);
    return new Response(buildCsv(rows), {
      status: 200,
      headers: {
        "cache-control": "no-store",
        "content-disposition": 'attachment; filename="admin-publications.csv"',
        "content-type": "text/csv; charset=utf-8"
      }
    });
  } catch {
    return NextResponse.json(
      {
        error: "export_failed"
      },
      { status: 500 }
    );
  }
};

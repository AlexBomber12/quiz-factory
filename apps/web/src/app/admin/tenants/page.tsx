import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { ADMIN_CSRF_FORM_FIELD } from "../../../lib/admin/csrf";
import { getAdminCsrfTokenForRender } from "../../../lib/admin/csrf_server";
import {
  getAdminTenantsSource,
  listAdminTenantsWithCounts,
  type AdminTenantWithCount
} from "../../../lib/admin/tenants";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "../../../lib/admin/session";

type SearchParams =
  | {
      error?: string | string[];
      detail?: string | string[];
      deleted?: string | string[];
    }
  | Promise<{
      error?: string | string[];
      detail?: string | string[];
      deleted?: string | string[];
    }>;

type PageProps = {
  searchParams?: SearchParams;
};

const inlineLinkClassName = "text-primary underline underline-offset-4 hover:no-underline";

const asSingleValue = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

const getSourceLabel = (source: ReturnType<typeof getAdminTenantsSource>): string => {
  return source === "db" ? "content_db (editable)" : "config/tenants.json (read-only)";
};

const buildErrorMessage = (errorCode: string | null, detail: string | null): string | null => {
  if (!errorCode) {
    return null;
  }

  const suffix = detail ? ` (${detail})` : "";

  switch (errorCode) {
    case "invalid_csrf":
      return "Request blocked by CSRF protection. Refresh the page and retry.";
    case "forbidden":
      return "Only admin can modify tenants.";
    case "source_not_db":
      return "TENANTS_SOURCE is file. Switch to TENANTS_SOURCE=db to edit tenants.";
    case "invalid_payload":
      return `Tenant payload is invalid${suffix}.`;
    case "conflict":
      return `Tenant or domain already exists${suffix}.`;
    case "not_found":
      return `Tenant record not found${suffix}.`;
    case "db_error":
      return "Tenant registry update failed due to a database error.";
    default:
      return `Operation failed (${errorCode})${suffix}.`;
  }
};

export default async function AdminTenantsPage({ searchParams }: PageProps) {
  const cookieStore = await cookies();
  const session = await verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    redirect("/admin/login");
  }

  const resolvedSearchParams = searchParams
    ? await Promise.resolve(searchParams)
    : undefined;
  const errorCode = asSingleValue(resolvedSearchParams?.error);
  const detail = asSingleValue(resolvedSearchParams?.detail);
  const deletedTenantId = asSingleValue(resolvedSearchParams?.deleted);

  const source = getAdminTenantsSource();
  const csrfToken = await getAdminCsrfTokenForRender();

  let records: AdminTenantWithCount[] = [];
  let loadError: string | null = null;

  try {
    records = await listAdminTenantsWithCounts();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unable to load tenants.";
  }

  const actionErrorMessage = buildErrorMessage(errorCode, detail);

  return (
    <section className="mx-auto flex w-full flex-col gap-6 py-2">
      <Card>
        <CardHeader>
          <CardTitle>Tenants registry</CardTitle>
          <CardDescription>Manage tenant identifiers, hostnames, locale, and enabled state.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Source</CardTitle>
          <CardDescription>Tenant source: {getSourceLabel(source)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {source === "db" ? (
            <p>
              Changes on this page update <code>tenants</code> and <code>tenant_domains</code>.
            </p>
          ) : (
            <p>
              Edit <code>config/tenants.csv</code> and regenerate <code>config/tenants.json</code> for changes.
            </p>
          )}
        </CardContent>
      </Card>

      {actionErrorMessage ? (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-red-700" role="alert">
              {actionErrorMessage}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {deletedTenantId ? (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-emerald-700" role="status">
              Deleted tenant <code>{deletedTenantId}</code>.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {source === "db" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create tenant</CardTitle>
            <CardDescription>Create tenant_id with at least one domain.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action="/api/admin/tenants" className="space-y-3" method="post">
              <input name={ADMIN_CSRF_FORM_FIELD} type="hidden" value={csrfToken} />
              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-1">
                  <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    tenant_id
                  </span>
                  <input
                    className="w-full rounded border bg-background px-2 py-2"
                    name="tenant_id"
                    placeholder="tenant-example-com"
                    required
                    type="text"
                  />
                </label>

                <label className="space-y-1">
                  <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    default_locale
                  </span>
                  <select className="w-full rounded border bg-background px-2 py-2" defaultValue="en" name="default_locale">
                    <option value="en">en</option>
                    <option value="es">es</option>
                    <option value="pt-BR">pt-BR</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    enabled
                  </span>
                  <select className="w-full rounded border bg-background px-2 py-2" defaultValue="true" name="enabled">
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                </label>
              </div>

              <label className="space-y-1">
                <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  domain
                </span>
                <input
                  className="w-full rounded border bg-background px-2 py-2"
                  name="domain"
                  placeholder="tenant.example.com"
                  required
                  type="text"
                />
              </label>

              <button
                className="inline-flex items-center rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                type="submit"
              >
                Create tenant
              </button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tenants</CardTitle>
          <CardDescription>
            {source === "db"
              ? "DB-backed tenant list with edit links."
              : "File-backed tenant list (read-only in this mode)."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadError ? (
            <p className="text-sm text-red-700" role="alert">
              Failed to load tenants: {loadError}
            </p>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 font-semibold">tenant_id</th>
                  <th className="px-2 py-2 font-semibold">domains</th>
                  <th className="px-2 py-2 font-semibold">default_locale</th>
                  <th className="px-2 py-2 font-semibold">enabled</th>
                  <th className="px-2 py-2 font-semibold">published tests</th>
                  <th className="px-2 py-2 font-semibold">actions</th>
                </tr>
              </thead>
              <tbody>
                {records.length > 0 ? (
                  records.map((record) => (
                    <tr className="border-b align-top" key={record.tenant_id}>
                      <td className="px-2 py-2">
                        <code>{record.tenant_id}</code>
                      </td>
                      <td className="px-2 py-2">{record.domains.length > 0 ? record.domains.join(", ") : "-"}</td>
                      <td className="px-2 py-2">{record.default_locale}</td>
                      <td className="px-2 py-2">{record.enabled ? "true" : "false"}</td>
                      <td className="px-2 py-2">{record.published_count}</td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-x-1 gap-y-1">
                          <Link
                            className={inlineLinkClassName}
                            href={`/admin/tenants/${encodeURIComponent(record.tenant_id)}`}
                          >
                            Open
                          </Link>
                          <span aria-hidden="true" className="text-muted-foreground">
                            |
                          </span>
                          <Link
                            className={inlineLinkClassName}
                            href={`/admin/analytics/tenants/${encodeURIComponent(record.tenant_id)}`}
                          >
                            Analytics
                          </Link>
                          {record.domains.length > 0 ? (
                            <>
                              <span aria-hidden="true" className="text-muted-foreground">
                                |
                              </span>
                              <Link className={inlineLinkClassName} href={`https://${record.domains[0]}/tests`}>
                                Public
                              </Link>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-2 py-4 text-muted-foreground" colSpan={6}>
                      No tenants found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { listAdminTenantsWithCounts, type AdminTenantWithCount } from "../../../lib/admin/tenants";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "../../../lib/admin/session";

const inlineLinkClassName = "text-primary underline underline-offset-4 hover:no-underline";

export default async function AdminTenantsPage() {
  const cookieStore = await cookies();
  const session = await verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    redirect("/admin/login");
  }

  let records: AdminTenantWithCount[] = [];
  let loadError: string | null = null;

  try {
    records = await listAdminTenantsWithCounts();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unable to load tenants.";
  }

  return (
    <section className="mx-auto flex w-full flex-col gap-6 py-2">
      <Card>
        <CardHeader>
          <CardTitle>Tenants registry</CardTitle>
          <CardDescription>Review configured tenants and published test counts.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tenants</CardTitle>
          <CardDescription>Tenant source: config/tenants.json</CardDescription>
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
                    <td className="px-2 py-4 text-muted-foreground" colSpan={5}>
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

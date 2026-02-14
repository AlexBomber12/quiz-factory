import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { getAdminTenantDetail } from "../../../../lib/admin/tenants";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "../../../../lib/admin/session";

type PageProps = {
  params: Promise<{ tenant_id: string }> | { tenant_id: string };
};

const resolveParams = async (
  params: PageProps["params"]
): Promise<{
  tenant_id: string;
}> => {
  return Promise.resolve(params);
};

export default async function AdminTenantDetailPage({ params }: PageProps) {
  const cookieStore = await cookies();
  const session = await verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    redirect("/admin/login");
  }

  const resolvedParams = await resolveParams(params);

  let detail: Awaited<ReturnType<typeof getAdminTenantDetail>>;
  try {
    detail = await getAdminTenantDetail(resolvedParams.tenant_id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load tenant detail.";
    return (
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 py-2">
        <Card>
          <CardHeader>
            <CardTitle>Tenant detail</CardTitle>
            <CardDescription>Failed to load tenant detail page.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-700" role="alert">
              {message}
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }

  if (!detail.tenant) {
    return (
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 py-2">
        <Card>
          <CardHeader>
            <CardTitle>Tenant not found</CardTitle>
            <CardDescription>
              No tenant found for <code>{resolvedParams.tenant_id}</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild type="button" variant="outline">
              <Link href="/admin/tenants">Back to tenants registry</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full flex-col gap-6 py-2">
      <Card>
        <CardHeader>
          <CardTitle>Tenant detail</CardTitle>
          <CardDescription className="space-y-1">
            <span className="block">
              tenant_id: <code>{detail.tenant.tenant_id}</code>
            </span>
            <span className="block">domains: {detail.tenant.domains.length > 0 ? detail.tenant.domains.join(", ") : "-"}</span>
            <span className="block">default_locale: {detail.tenant.default_locale}</span>
            <span className="block">enabled published tests: {detail.tenant.published_count}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild type="button" variant="ghost">
            <Link href="/admin/tenants">Back to tenants registry</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Published tests</CardTitle>
          <CardDescription>Current tenant publication rows with linked test detail pages.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 font-semibold">test_id</th>
                  <th className="px-2 py-2 font-semibold">slug</th>
                  <th className="px-2 py-2 font-semibold">published_version_id</th>
                  <th className="px-2 py-2 font-semibold">enabled</th>
                  <th className="px-2 py-2 font-semibold">link</th>
                </tr>
              </thead>
              <tbody>
                {detail.published_tests.length > 0 ? (
                  detail.published_tests.map((record) => (
                    <tr className="border-b align-top" key={`${record.test_id}:${record.published_version_id}`}>
                      <td className="px-2 py-2">
                        <code>{record.test_id}</code>
                      </td>
                      <td className="px-2 py-2">{record.slug}</td>
                      <td className="px-2 py-2">
                        <code className="break-all">{record.published_version_id}</code>
                      </td>
                      <td className="px-2 py-2">{record.enabled ? "true" : "false"}</td>
                      <td className="px-2 py-2">
                        <Link
                          className="text-primary underline underline-offset-4 hover:no-underline"
                          href={`/admin/tests/${encodeURIComponent(record.test_id)}`}
                        >
                          Open test
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-2 py-4 text-muted-foreground" colSpan={5}>
                      No published tests found for this tenant.
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

import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import TestPublishPanel from "../../../../components/admin/TestPublishPanel";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { getAdminCsrfTokenForRender } from "../../../../lib/admin/csrf_server";
import { readAdminDiagnostics } from "../../../../lib/admin/diagnostics";
import { listTenantRegistry } from "../../../../lib/admin/publish";
import { getAdminTestDetail, type AdminTestDetailPublication } from "../../../../lib/admin/tests";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "../../../../lib/admin/session";

type PageProps = {
  params: Promise<{ test_id: string }> | { test_id: string };
};

type TenantPublicationRow = {
  tenant_id: string;
  domains: string[];
  is_enabled: boolean;
  published_version_id: string | null;
};

const resolveParams = async (
  params: PageProps["params"]
): Promise<{ test_id: string }> => {
  return Promise.resolve(params);
};

const buildPublicationRows = (
  publications: AdminTestDetailPublication[]
): {
  rows: TenantPublicationRow[];
  knownTenants: Array<{ tenant_id: string; domains: string[] }>;
  panelPublications: AdminTestDetailPublication[];
} => {
  const tenantRegistry = listTenantRegistry();
  const publicationByTenant = new Map(publications.map((entry) => [entry.tenant_id, entry]));

  const rows: TenantPublicationRow[] = tenantRegistry.map((tenant) => {
    const publication = publicationByTenant.get(tenant.tenant_id);
    publicationByTenant.delete(tenant.tenant_id);

    return {
      tenant_id: tenant.tenant_id,
      domains: tenant.domains,
      is_enabled: publication?.is_enabled ?? false,
      published_version_id: publication?.published_version_id ?? null
    };
  });

  for (const publication of publicationByTenant.values()) {
    rows.push({
      tenant_id: publication.tenant_id,
      domains: [],
      is_enabled: publication.is_enabled,
      published_version_id: publication.published_version_id
    });
  }

  rows.sort((left, right) => left.tenant_id.localeCompare(right.tenant_id));

  const panelPublications = rows.map((row) => ({
    tenant_id: row.tenant_id,
    is_enabled: row.is_enabled,
    published_version_id: row.published_version_id
  }));

  return {
    rows,
    knownTenants: tenantRegistry.map((entry) => ({
      tenant_id: entry.tenant_id,
      domains: entry.domains
    })),
    panelPublications
  };
};

export default async function AdminTestDetailPage({ params }: PageProps) {
  const cookieStore = await cookies();
  const session = await verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    redirect("/admin/login");
  }

  const resolvedParams = await resolveParams(params);

  let detail: Awaited<ReturnType<typeof getAdminTestDetail>>;
  try {
    detail = await getAdminTestDetail(resolvedParams.test_id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load test detail.";

    return (
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 py-2">
        <Card>
          <CardHeader>
            <CardTitle>Test detail</CardTitle>
            <CardDescription>Failed to load test detail page.</CardDescription>
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

  if (!detail.test) {
    return (
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 py-2">
        <Card>
          <CardHeader>
            <CardTitle>Test not found</CardTitle>
            <CardDescription>
              No test found for <code>{resolvedParams.test_id}</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild type="button" variant="outline">
              <Link href="/admin/tests">Back to tests registry</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  const publicationData = buildPublicationRows(detail.publications);
  const csrfToken = await getAdminCsrfTokenForRender();
  const diagnostics = await readAdminDiagnostics();

  return (
    <section className="mx-auto flex w-full flex-col gap-6 py-2">
      <Card>
        <CardHeader>
          <CardTitle>Test detail</CardTitle>
          <CardDescription className="space-y-1">
            <span className="block">
              test_id: <code>{detail.test.test_id}</code>
            </span>
            <span className="block">
              slug: <code>{detail.test.slug}</code>
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild type="button" variant="outline">
            <Link href={`/t/${encodeURIComponent(detail.test.slug)}`}>Open /t/{detail.test.slug}</Link>
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/tests">Open /tests</Link>
          </Button>
          <Button asChild type="button" variant="ghost">
            <Link href="/admin/tests">Back to registry</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Versions</CardTitle>
          <CardDescription>Most recent first.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 font-semibold">version_id</th>
                  <th className="px-2 py-2 font-semibold">version</th>
                  <th className="px-2 py-2 font-semibold">status</th>
                  <th className="px-2 py-2 font-semibold">created_at</th>
                  <th className="px-2 py-2 font-semibold">created_by</th>
                  <th className="px-2 py-2 font-semibold">checksum</th>
                </tr>
              </thead>
              <tbody>
                {detail.versions.length > 0 ? (
                  detail.versions.map((version) => (
                    <tr className="border-b align-top" key={version.version_id}>
                      <td className="px-2 py-2">
                        <code className="break-all">{version.version_id}</code>
                      </td>
                      <td className="px-2 py-2">{version.version}</td>
                      <td className="px-2 py-2">{version.status}</td>
                      <td className="px-2 py-2">{version.created_at}</td>
                      <td className="px-2 py-2">{version.created_by ?? "-"}</td>
                      <td className="px-2 py-2">
                        <code className="break-all">{version.checksum}</code>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-2 py-4 text-muted-foreground" colSpan={6}>
                      No versions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <TestPublishPanel
        csrfToken={csrfToken}
        publications={publicationData.panelPublications}
        publishActionsDisabledMessage={diagnostics.publishActionsDisabledReason}
        publishActionsEnabled={diagnostics.publishActionsEnabled}
        tenants={publicationData.knownTenants}
        testId={detail.test.test_id}
        versions={detail.versions.map((version) => ({
          version_id: version.version_id,
          version: version.version
        }))}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Published on tenants</CardTitle>
          <CardDescription>
            Tenant registry source: <code>config/tenants.json</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 font-semibold">tenant_id</th>
                  <th className="px-2 py-2 font-semibold">enabled</th>
                  <th className="px-2 py-2 font-semibold">published_version_id</th>
                  <th className="px-2 py-2 font-semibold">domains</th>
                </tr>
              </thead>
              <tbody>
                {publicationData.rows.length > 0 ? (
                  publicationData.rows.map((row) => (
                    <tr className="border-b align-top" key={row.tenant_id}>
                      <td className="px-2 py-2">
                        <code>{row.tenant_id}</code>
                      </td>
                      <td className="px-2 py-2">{row.is_enabled ? "true" : "false"}</td>
                      <td className="px-2 py-2">
                        {row.published_version_id ? (
                          <code className="break-all">{row.published_version_id}</code>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-2 py-2">{row.domains.length > 0 ? row.domains.join(", ") : "-"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-2 py-4 text-muted-foreground" colSpan={4}>
                      No tenant publication rows found.
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

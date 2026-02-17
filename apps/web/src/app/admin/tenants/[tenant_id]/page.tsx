import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { ADMIN_CSRF_FORM_FIELD } from "../../../../lib/admin/csrf";
import { getAdminCsrfTokenForRender } from "../../../../lib/admin/csrf_server";
import { getAdminTenantsSource, getAdminTenantDetail } from "../../../../lib/admin/tenants";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "../../../../lib/admin/session";

type SearchParams =
  | {
      created?: string | string[];
      updated?: string | string[];
      domain_added?: string | string[];
      domain_removed?: string | string[];
      error?: string | string[];
      domain_error?: string | string[];
      detail?: string | string[];
    }
  | Promise<{
      created?: string | string[];
      updated?: string | string[];
      domain_added?: string | string[];
      domain_removed?: string | string[];
      error?: string | string[];
      domain_error?: string | string[];
      detail?: string | string[];
    }>;

type PageProps = {
  params: Promise<{ tenant_id: string }> | { tenant_id: string };
  searchParams?: SearchParams;
};

const resolveParams = async (
  params: PageProps["params"]
): Promise<{
  tenant_id: string;
}> => {
  return Promise.resolve(params);
};

const inlineLinkClassName = "text-primary underline underline-offset-4 hover:no-underline";

const asSingleValue = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

const buildErrorMessage = (errorCode: string | null, detail: string | null): string | null => {
  if (!errorCode) {
    return null;
  }

  const suffix = detail ? ` (${detail})` : "";

  switch (errorCode) {
    case "invalid_csrf":
      return "Request blocked by CSRF protection. Refresh and retry.";
    case "forbidden":
      return "Only admin can modify tenants.";
    case "source_not_db":
      return "TENANTS_SOURCE is file. Switch to TENANTS_SOURCE=db to edit tenants.";
    case "invalid_payload":
      return `Tenant update payload is invalid${suffix}.`;
    case "conflict":
      return `Tenant or domain conflict detected${suffix}.`;
    case "not_found":
      return `Tenant or domain not found${suffix}.`;
    case "db_error":
      return "Tenant registry update failed due to a database error.";
    default:
      return `Operation failed (${errorCode})${suffix}.`;
  }
};

export default async function AdminTenantDetailPage({ params, searchParams }: PageProps) {
  const cookieStore = await cookies();
  const session = await verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    redirect("/admin/login");
  }

  const resolvedParams = await resolveParams(params);
  const resolvedSearchParams = searchParams
    ? await Promise.resolve(searchParams)
    : undefined;

  const source = getAdminTenantsSource();
  const csrfToken = await getAdminCsrfTokenForRender();

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

  const tenant = detail.tenant;
  const modeError = buildErrorMessage(
    asSingleValue(resolvedSearchParams?.error) ?? asSingleValue(resolvedSearchParams?.domain_error),
    asSingleValue(resolvedSearchParams?.detail)
  );

  const infoMessages = [
    asSingleValue(resolvedSearchParams?.created) === "ok" ? "Tenant created." : null,
    asSingleValue(resolvedSearchParams?.updated) === "ok" ? "Tenant updated." : null,
    asSingleValue(resolvedSearchParams?.domain_added) === "ok" ? "Domain added." : null,
    asSingleValue(resolvedSearchParams?.domain_removed) === "ok" ? "Domain removed." : null
  ].filter((entry): entry is string => entry !== null);

  return (
    <section className="mx-auto flex w-full flex-col gap-6 py-2">
      {modeError ? (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-red-700" role="alert">
              {modeError}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {infoMessages.length > 0 ? (
        <Card>
          <CardContent className="space-y-1 py-4">
            {infoMessages.map((message) => (
              <p className="text-sm text-emerald-700" key={message} role="status">
                {message}
              </p>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Tenant detail</CardTitle>
          <CardDescription className="space-y-1">
            <span className="block">
              tenant_id: <code>{tenant.tenant_id}</code>
            </span>
            <span className="block">domains: {tenant.domains.length > 0 ? tenant.domains.join(", ") : "-"}</span>
            <span className="block">default_locale: {tenant.default_locale}</span>
            <span className="block">enabled: {tenant.enabled ? "true" : "false"}</span>
            <span className="block">enabled published tests: {tenant.published_count}</span>
            <span className="block">source: {source === "db" ? "content_db" : "config/tenants.json"}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild type="button" variant="outline">
            <Link href={`/admin/analytics/tenants/${encodeURIComponent(tenant.tenant_id)}`}>
              Analytics tenant
            </Link>
          </Button>
          {tenant.domains.map((domain) => (
            <Button asChild key={domain} type="button" variant="outline">
              <Link href={`https://${domain}/tests`} rel="noreferrer" target="_blank">
                Public /tests ({domain})
              </Link>
            </Button>
          ))}
          <Button asChild type="button" variant="ghost">
            <Link href="/admin/tenants">Back to tenants registry</Link>
          </Button>
        </CardContent>
      </Card>

      {source === "db" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edit tenant</CardTitle>
            <CardDescription>Update locale, enabled state, and domain list.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form
              action={`/api/admin/tenants/${encodeURIComponent(tenant.tenant_id)}?_method=PATCH`}
              className="space-y-3 rounded border p-3"
              method="post"
            >
              <input name={ADMIN_CSRF_FORM_FIELD} type="hidden" value={csrfToken} />
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    default_locale
                  </span>
                  <select
                    className="w-full rounded border bg-background px-2 py-2"
                    defaultValue={tenant.default_locale}
                    name="default_locale"
                  >
                    <option value="en">en</option>
                    <option value="es">es</option>
                    <option value="pt-BR">pt-BR</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    enabled
                  </span>
                  <select
                    className="w-full rounded border bg-background px-2 py-2"
                    defaultValue={tenant.enabled ? "true" : "false"}
                    name="enabled"
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                </label>
              </div>

              <button
                className="inline-flex items-center rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                type="submit"
              >
                Save tenant
              </button>
            </form>

            <div className="space-y-3 rounded border p-3">
              <h3 className="text-sm font-medium">Domains</h3>

              <form
                action={`/api/admin/tenants/${encodeURIComponent(tenant.tenant_id)}/domains`}
                className="flex flex-col gap-2 sm:flex-row"
                method="post"
              >
                <input name={ADMIN_CSRF_FORM_FIELD} type="hidden" value={csrfToken} />
                <input
                  className="w-full rounded border bg-background px-2 py-2 text-sm"
                  name="domain"
                  placeholder="new-domain.example.com"
                  required
                  type="text"
                />
                <button
                  className="inline-flex items-center rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                  type="submit"
                >
                  Add domain
                </button>
              </form>

              <div className="space-y-2">
                {tenant.domains.map((domain) => (
                  <div className="flex items-center justify-between gap-2 rounded border px-3 py-2" key={domain}>
                    <code className="text-sm">{domain}</code>
                    <form
                      action={`/api/admin/tenants/${encodeURIComponent(tenant.tenant_id)}/domains?_method=DELETE`}
                      method="post"
                    >
                      <input name={ADMIN_CSRF_FORM_FIELD} type="hidden" value={csrfToken} />
                      <input name="domain" type="hidden" value={domain} />
                      <button
                        className="inline-flex items-center rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-700"
                        type="submit"
                      >
                        Remove
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            </div>

            <form action={`/api/admin/tenants/${encodeURIComponent(tenant.tenant_id)}?_method=DELETE`} method="post">
              <input name={ADMIN_CSRF_FORM_FIELD} type="hidden" value={csrfToken} />
              <button
                className="inline-flex items-center rounded border border-red-500 px-3 py-2 text-sm font-medium text-red-700"
                type="submit"
              >
                Delete tenant
              </button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Read-only mode</CardTitle>
            <CardDescription>
              Tenant edits are disabled because <code>TENANTS_SOURCE=file</code>. Update CSV/JSON files instead.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

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
                  <th className="px-2 py-2 font-semibold">public</th>
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
                        <Link className={inlineLinkClassName} href={`/admin/tests/${encodeURIComponent(record.test_id)}`}>
                          Open test
                        </Link>
                      </td>
                      <td className="px-2 py-2">
                        {tenant.domains.length > 0 ? (
                          <Link
                            className={inlineLinkClassName}
                            href={`https://${tenant.domains[0]}/t/${encodeURIComponent(record.slug)}`}
                          >
                            Open public
                          </Link>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-2 py-4 text-muted-foreground" colSpan={6}>
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

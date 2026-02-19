import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import PublicationToggleButton from "./publication-toggle-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { getAdminCsrfTokenForRender } from "@/lib/admin/csrf_server";
import {
  listAdminPublications,
  type AdminPublicationRow,
  type ListAdminPublicationsFilters
} from "@/lib/admin/publications";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin/session";

type SearchParams = {
  q?: string | string[];
  tenant_id?: string | string[];
  content_type?: string | string[];
  only_published?: string | string[];
  only_enabled?: string | string[];
};

type PageProps = {
  searchParams?: SearchParams | Promise<SearchParams>;
};

const TRUE_BOOLEAN_VALUES = new Set(["1", "true", "yes", "on"]);
const inlineLinkClassName = "text-primary underline underline-offset-4 hover:no-underline";

const asSingleValue = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

const parseBooleanFilter = (value: string | null): boolean => {
  if (!value) {
    return false;
  }

  return TRUE_BOOLEAN_VALUES.has(value.trim().toLowerCase());
};

const readFilters = async (
  searchParams: PageProps["searchParams"]
): Promise<ListAdminPublicationsFilters> => {
  if (!searchParams) {
    return {
      q: null,
      tenant_id: null,
      content_type: null,
      only_published: false,
      only_enabled: false
    };
  }

  const resolved = await Promise.resolve(searchParams);
  return {
    q: asSingleValue(resolved.q),
    tenant_id: asSingleValue(resolved.tenant_id),
    content_type: asSingleValue(resolved.content_type),
    only_published: parseBooleanFilter(asSingleValue(resolved.only_published)),
    only_enabled: parseBooleanFilter(asSingleValue(resolved.only_enabled))
  };
};

const buildExportHref = (filters: ListAdminPublicationsFilters): string => {
  const query = new URLSearchParams();
  if (filters.q) {
    query.set("q", filters.q);
  }
  if (filters.tenant_id) {
    query.set("tenant_id", filters.tenant_id);
  }
  if (filters.content_type) {
    query.set("content_type", filters.content_type);
  }
  if (filters.only_published) {
    query.set("only_published", "1");
  }
  if (filters.only_enabled) {
    query.set("only_enabled", "1");
  }

  const queryString = query.toString();
  return queryString.length > 0
    ? `/api/admin/publications/export?${queryString}`
    : "/api/admin/publications/export";
};

export default async function AdminPublicationsPage({ searchParams }: PageProps) {
  const cookieStore = await cookies();
  const session = await verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    redirect("/admin/login");
  }

  const filters = await readFilters(searchParams);
  const csrfToken = await getAdminCsrfTokenForRender();

  let rows: AdminPublicationRow[] = [];
  let loadError: string | null = null;

  try {
    rows = await listAdminPublications(filters);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unable to load publications.";
  }

  return (
    <section className="mx-auto flex w-full flex-col gap-6 py-2">
      <Card>
        <CardHeader>
          <CardTitle>Publications registry</CardTitle>
          <CardDescription>
            Tenant x content matrix with published version state and enabled flag.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Filter by tenant, content type, and publication state.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto_auto_auto]"
            method="get"
          >
            <label className="space-y-1">
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">q</span>
              <input
                className="w-full rounded border bg-background px-2 py-2 text-sm"
                defaultValue={filters.q ?? ""}
                name="q"
                placeholder="tenant_id, content_key, slug, domain"
                type="search"
              />
            </label>

            <label className="space-y-1">
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                tenant_id
              </span>
              <input
                className="w-full rounded border bg-background px-2 py-2 text-sm"
                defaultValue={filters.tenant_id ?? ""}
                name="tenant_id"
                placeholder="tenant-..."
                type="text"
              />
            </label>

            <label className="space-y-1">
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                content_type
              </span>
              <input
                className="w-full rounded border bg-background px-2 py-2 text-sm"
                defaultValue={filters.content_type ?? ""}
                name="content_type"
                placeholder="test"
                type="text"
              />
            </label>

            <label className="flex items-center gap-2 self-end rounded border px-3 py-2 text-sm">
              <input
                defaultChecked={Boolean(filters.only_published)}
                name="only_published"
                type="checkbox"
                value="1"
              />
              <span>Only published</span>
            </label>

            <label className="flex items-center gap-2 self-end rounded border px-3 py-2 text-sm">
              <input
                defaultChecked={Boolean(filters.only_enabled)}
                name="only_enabled"
                type="checkbox"
                value="1"
              />
              <span>Only enabled</span>
            </label>

            <Button className="self-end" type="submit" variant="secondary">
              Apply filters
            </Button>
            <div className="flex items-center gap-2 self-end">
              <Button asChild type="button" variant="outline">
                <Link href={buildExportHref(filters)}>Export CSV</Link>
              </Button>
              <Button asChild type="button" variant="ghost">
                <Link href="/admin/publications">Clear</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Publications</CardTitle>
          <CardDescription>Sorted by tenant_id, content_type, slug, and content_key.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadError ? (
            <p className="text-sm text-red-700" role="alert">
              Failed to load publications: {loadError}
            </p>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1320px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 font-semibold">tenant_id</th>
                  <th className="px-2 py-2 font-semibold">domains</th>
                  <th className="px-2 py-2 font-semibold">content_type</th>
                  <th className="px-2 py-2 font-semibold">content_key</th>
                  <th className="px-2 py-2 font-semibold">slug</th>
                  <th className="px-2 py-2 font-semibold">published_version_id</th>
                  <th className="px-2 py-2 font-semibold">enabled</th>
                  <th className="px-2 py-2 font-semibold">links</th>
                </tr>
              </thead>
              <tbody>
                {rows.length > 0 ? (
                  rows.map((record) => {
                    const isTestContent = record.content_type === "test";
                    const testId = isTestContent ? record.content_key : null;
                    const publicDomain = record.domains[0] ?? null;
                    const publicHref = isTestContent && publicDomain
                      ? `https://${publicDomain}/t/${encodeURIComponent(record.slug)}`
                      : null;

                    return (
                      <tr
                        className="border-b align-top"
                        key={`${record.tenant_id}:${record.content_type}:${record.content_key}`}
                      >
                        <td className="px-2 py-2">
                          <code>{record.tenant_id}</code>
                        </td>
                        <td className="px-2 py-2">{record.domains.length > 0 ? record.domains.join(", ") : "-"}</td>
                        <td className="px-2 py-2">
                          <code>{record.content_type}</code>
                        </td>
                        <td className="px-2 py-2">
                          <code>{record.content_key}</code>
                        </td>
                        <td className="px-2 py-2">{record.slug}</td>
                        <td className="px-2 py-2">
                          {record.published_version_id ? (
                            <code className="break-all">{record.published_version_id}</code>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <div className="space-y-2">
                            <p>{record.is_enabled ? "true" : "false"}</p>
                            {record.published_version_id && testId ? (
                              <PublicationToggleButton
                                csrfToken={csrfToken}
                                isEnabled={record.is_enabled}
                                tenantId={record.tenant_id}
                                testId={testId}
                                versionId={record.published_version_id}
                              />
                            ) : null}
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex flex-wrap gap-x-1 gap-y-1">
                            <Link
                              className={inlineLinkClassName}
                              href={`/admin/tenants/${encodeURIComponent(record.tenant_id)}`}
                            >
                              Admin tenant
                            </Link>
                            <span aria-hidden="true" className="text-muted-foreground">
                              |
                            </span>
                            <Link
                              className={inlineLinkClassName}
                              href={`/admin/analytics/tenants/${encodeURIComponent(record.tenant_id)}`}
                            >
                              Tenant analytics
                            </Link>
                            {testId ? (
                              <>
                                <span aria-hidden="true" className="text-muted-foreground">
                                  |
                                </span>
                                <Link
                                  className={inlineLinkClassName}
                                  href={`/admin/tests/${encodeURIComponent(testId)}`}
                                >
                                  Admin test
                                </Link>
                                <span aria-hidden="true" className="text-muted-foreground">
                                  |
                                </span>
                                <Link
                                  className={inlineLinkClassName}
                                  href={`/admin/analytics/tests/${encodeURIComponent(testId)}`}
                                >
                                  Test analytics
                                </Link>
                                {publicHref ? (
                                  <>
                                    <span aria-hidden="true" className="text-muted-foreground">
                                      |
                                    </span>
                                    <Link className={inlineLinkClassName} href={publicHref}>
                                      Public URL
                                    </Link>
                                  </>
                                ) : null}
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="px-2 py-4 text-muted-foreground" colSpan={8}>
                      No publication rows found for the current filters.
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

import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { ADMIN_CSRF_FORM_FIELD } from "@/lib/admin/csrf";
import { getAdminCsrfTokenForRender } from "@/lib/admin/csrf_server";
import { listTenantRegistry } from "@/lib/admin/publish";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin/session";
import { getAdminProductDetail } from "@/lib/content_db/products_repo";

type SearchParams = {
  version_created?: string | string[];
  published?: string | string[];
  error?: string | string[];
  detail?: string | string[];
};

type PageProps = {
  params: Promise<{ product_id: string }> | { product_id: string };
  searchParams?: SearchParams | Promise<SearchParams>;
};

const asSingleValue = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

const resolveParams = async (
  params: PageProps["params"]
): Promise<{ product_id: string }> => {
  return Promise.resolve(params);
};

const readPageState = async (
  searchParams: PageProps["searchParams"]
): Promise<{
  versionCreated: string | null;
  published: string | null;
  error: string | null;
  detail: string | null;
}> => {
  if (!searchParams) {
    return {
      versionCreated: null,
      published: null,
      error: null,
      detail: null
    };
  }

  const resolved = await Promise.resolve(searchParams);
  return {
    versionCreated: asSingleValue(resolved.version_created),
    published: asSingleValue(resolved.published),
    error: asSingleValue(resolved.error),
    detail: asSingleValue(resolved.detail)
  };
};

const buildErrorMessage = (code: string | null, detail: string | null): string | null => {
  if (!code) {
    return null;
  }

  const suffix = detail ? ` (${detail})` : "";
  switch (code) {
    case "unauthorized":
      return "You are not authorized for this action.";
    case "forbidden":
      return "Only admin can modify products.";
    case "invalid_csrf":
      return "Request blocked by CSRF protection. Refresh the page and retry.";
    case "invalid_product_id":
    case "invalid_version_id":
    case "invalid_tenant_id":
    case "invalid_is_enabled":
      return `Invalid publish parameters${suffix}.`;
    case "invalid_spec_json":
      return `spec_json must be a valid JSON object${suffix}.`;
    case "product_not_found":
      return `Product not found${suffix}.`;
    case "version_not_found":
      return `Selected version does not belong to this product${suffix}.`;
    case "db_error":
      return "Database operation failed.";
    default:
      return `Operation failed (${code})${suffix}.`;
  }
};

const buildSuccessMessage = (state: {
  versionCreated: string | null;
  published: string | null;
}): string | null => {
  if (state.versionCreated === "ok") {
    return "Draft product version created.";
  }

  if (state.published === "ok") {
    return "Product version published to tenant.";
  }

  return null;
};

const buildDraftTemplate = (slug: string): string => {
  return JSON.stringify(
    {
      title: slug
        .split("-")
        .map((part) => part[0]?.toUpperCase() + part.slice(1))
        .join(" "),
      description: "Short product description.",
      price: {
        amount: 0,
        currency: "USD",
        label: "$0"
      },
      images: [],
      attributes: {
        format: "digital"
      },
      locales: {
        en: {
          title: "Product title",
          description: "Localized description",
          price: "$0"
        }
      }
    },
    null,
    2
  );
};

export default async function AdminProductDetailPage({ params, searchParams }: PageProps) {
  const cookieStore = await cookies();
  const session = await verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    redirect("/admin/login");
  }

  const resolvedParams = await resolveParams(params);
  const pageState = await readPageState(searchParams);

  const detail = await getAdminProductDetail(resolvedParams.product_id);
  if (!detail.product) {
    return (
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 py-2">
        <Card>
          <CardHeader>
            <CardTitle>Product not found</CardTitle>
            <CardDescription>
              No product found for <code>{resolvedParams.product_id}</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild type="button" variant="outline">
              <Link href="/admin/products">Back to products registry</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  const csrfToken = await getAdminCsrfTokenForRender();
  const tenantRegistry = listTenantRegistry();
  const tenantDomains = new Map(
    tenantRegistry.map((entry) => [entry.tenant_id, entry.domains])
  );
  const successMessage = buildSuccessMessage(pageState);
  const errorMessage = buildErrorMessage(pageState.error, pageState.detail);
  const defaultVersionId = detail.versions[0]?.version_id ?? "";

  return (
    <section className="mx-auto flex w-full flex-col gap-6 py-2">
      <Card>
        <CardHeader>
          <CardTitle>Product detail</CardTitle>
          <CardDescription className="space-y-1">
            <span className="block">
              product_id: <code>{detail.product.product_id}</code>
            </span>
            <span className="block">
              slug: <code>{detail.product.slug}</code>
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild type="button" variant="outline">
            <Link href={`/p/${encodeURIComponent(detail.product.slug)}`}>
              Open /p/{detail.product.slug}
            </Link>
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/products">Open /products</Link>
          </Button>
          <Button asChild type="button" variant="ghost">
            <Link href="/admin/products">Back to registry</Link>
          </Button>
        </CardContent>
      </Card>

      {successMessage ? (
        <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">
          {successMessage}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create draft version</CardTitle>
          <CardDescription>
            Adds the next sequential product version with <code>status=draft</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={`/api/admin/products/${encodeURIComponent(detail.product.product_id)}/versions`}
            className="space-y-3"
            method="post"
          >
            <input name={ADMIN_CSRF_FORM_FIELD} type="hidden" value={csrfToken} />
            <label className="space-y-1">
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                spec_json
              </span>
              <textarea
                className="min-h-56 w-full rounded border bg-background px-2 py-2 font-mono text-xs"
                defaultValue={buildDraftTemplate(detail.product.slug)}
                name="spec_json"
                required
              />
            </label>

            <Button type="submit">Create draft version</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Publish to tenant</CardTitle>
          <CardDescription>
            Publishing upserts <code>content_items</code> and <code>domain_publications</code> rows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {detail.versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Create at least one version before publishing.</p>
          ) : (
            <form
              action={`/api/admin/products/${encodeURIComponent(detail.product.product_id)}/publish`}
              className="grid gap-3 md:grid-cols-2"
              method="post"
            >
              <input name={ADMIN_CSRF_FORM_FIELD} type="hidden" value={csrfToken} />
              <label className="space-y-1">
                <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  version_id
                </span>
                <select className="w-full rounded border bg-background px-2 py-2" defaultValue={defaultVersionId} name="version_id">
                  {detail.versions.map((version) => (
                    <option key={version.version_id} value={version.version_id}>
                      v{version.version} ({version.status})
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  tenant_id
                </span>
                <select className="w-full rounded border bg-background px-2 py-2" name="tenant_id">
                  {tenantRegistry.map((tenant) => (
                    <option key={tenant.tenant_id} value={tenant.tenant_id}>
                      {tenant.tenant_id}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 md:col-span-2">
                <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  is_enabled
                </span>
                <select className="w-full rounded border bg-background px-2 py-2" defaultValue="true" name="is_enabled">
                  <option value="true">true (enabled)</option>
                  <option value="false">false (disabled)</option>
                </select>
              </label>

              <div className="md:col-span-2">
                <Button type="submit">Publish version</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Versions</CardTitle>
          <CardDescription>Most recent first.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 font-semibold">version_id</th>
                  <th className="px-2 py-2 font-semibold">version</th>
                  <th className="px-2 py-2 font-semibold">status</th>
                  <th className="px-2 py-2 font-semibold">created_at</th>
                  <th className="px-2 py-2 font-semibold">created_by</th>
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
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-2 py-4 text-muted-foreground" colSpan={5}>
                      No versions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Published on tenants</CardTitle>
          <CardDescription>Rows from domain_publications for content_type=product.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 font-semibold">tenant_id</th>
                  <th className="px-2 py-2 font-semibold">enabled</th>
                  <th className="px-2 py-2 font-semibold">published_version_id</th>
                  <th className="px-2 py-2 font-semibold">published_version</th>
                  <th className="px-2 py-2 font-semibold">published_at</th>
                  <th className="px-2 py-2 font-semibold">domains</th>
                </tr>
              </thead>
              <tbody>
                {detail.publications.length > 0 ? (
                  detail.publications.map((row) => (
                    <tr className="border-b align-top" key={`${row.tenant_id}:${row.published_version_id ?? "none"}`}>
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
                      <td className="px-2 py-2">{row.published_version ?? "-"}</td>
                      <td className="px-2 py-2">{row.published_at ?? "-"}</td>
                      <td className="px-2 py-2">
                        {tenantDomains.get(row.tenant_id)?.join(", ") ?? "-"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-2 py-4 text-muted-foreground" colSpan={6}>
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

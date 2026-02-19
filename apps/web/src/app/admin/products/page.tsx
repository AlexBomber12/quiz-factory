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
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin/session";
import { listAdminProducts, type AdminProductListRecord } from "@/lib/content_db/products_repo";

type SearchParams = {
  q?: string | string[];
  created?: string | string[];
  error?: string | string[];
  detail?: string | string[];
};

type PageProps = {
  searchParams?: SearchParams | Promise<SearchParams>;
};

const asSingleValue = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

const readPageState = async (
  searchParams: PageProps["searchParams"]
): Promise<{
  q: string | null;
  created: string | null;
  error: string | null;
  detail: string | null;
}> => {
  if (!searchParams) {
    return {
      q: null,
      created: null,
      error: null,
      detail: null
    };
  }

  const resolved = await Promise.resolve(searchParams);
  return {
    q: asSingleValue(resolved.q),
    created: asSingleValue(resolved.created),
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
      return "Only admin can create products.";
    case "invalid_csrf":
      return "Request blocked by CSRF protection. Refresh the page and retry.";
    case "invalid_slug":
      return `Invalid slug${suffix}.`;
    case "product_exists":
      return `Product already exists${suffix}.`;
    case "db_error":
      return "Database operation failed.";
    default:
      return `Operation failed (${code})${suffix}.`;
  }
};

const buildSuccessMessage = (created: string | null): string | null => {
  if (created === "ok") {
    return "Product created.";
  }

  return null;
};

const renderLatestVersion = (record: AdminProductListRecord) => {
  if (record.latest_version !== null) {
    return `v${record.latest_version}`;
  }

  if (record.latest_version_id) {
    return <code className="break-all">{record.latest_version_id}</code>;
  }

  return "-";
};

export default async function AdminProductsPage({ searchParams }: PageProps) {
  const cookieStore = await cookies();
  const session = await verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    redirect("/admin/login");
  }

  const pageState = await readPageState(searchParams);
  const csrfToken = await getAdminCsrfTokenForRender();

  let records: AdminProductListRecord[] = [];
  let loadError: string | null = null;
  try {
    records = await listAdminProducts({
      q: pageState.q
    });
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unable to load products.";
  }

  const successMessage = buildSuccessMessage(pageState.created);
  const errorMessage = buildErrorMessage(pageState.error, pageState.detail);

  return (
    <section className="mx-auto flex w-full flex-col gap-6 py-2">
      <Card>
        <CardHeader>
          <CardTitle>Products registry</CardTitle>
          <CardDescription>
            Create products and manage versions before publishing to tenant domains.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create product</CardTitle>
          <CardDescription>
            Enter a slug and the system creates <code>product-&lt;slug&gt;</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {successMessage ? (
            <p className="text-sm text-emerald-700" role="status">
              {successMessage}
            </p>
          ) : null}

          {errorMessage ? (
            <p className="text-sm text-red-700" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <form action="/api/admin/products" className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]" method="post">
            <input name={ADMIN_CSRF_FORM_FIELD} type="hidden" value={csrfToken} />
            <label className="space-y-1">
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                slug
              </span>
              <input
                className="w-full rounded border bg-background px-2 py-2 text-sm"
                name="slug"
                placeholder="focus-kit"
                required
                type="text"
              />
            </label>

            <Button className="self-end" type="submit">
              Create product
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter</CardTitle>
          <CardDescription>Search by product_id or slug.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]" method="get">
            <label className="space-y-1">
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                q
              </span>
              <input
                className="w-full rounded border bg-background px-2 py-2 text-sm"
                defaultValue={pageState.q ?? ""}
                name="q"
                placeholder="product_id or slug"
                type="search"
              />
            </label>

            <Button className="self-end" type="submit" variant="secondary">
              Apply filter
            </Button>
            <Button asChild className="self-end" type="button" variant="outline">
              <Link href="/admin/products">Clear</Link>
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Products</CardTitle>
          <CardDescription>Most recently updated first.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadError ? (
            <p className="text-sm text-red-700" role="alert">
              Failed to load products: {loadError}
            </p>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 font-semibold">product_id</th>
                  <th className="px-2 py-2 font-semibold">slug</th>
                  <th className="px-2 py-2 font-semibold">latest version</th>
                  <th className="px-2 py-2 font-semibold">published tenants</th>
                  <th className="px-2 py-2 font-semibold">actions</th>
                </tr>
              </thead>
              <tbody>
                {records.length > 0 ? (
                  records.map((record) => (
                    <tr className="border-b align-top" key={record.product_id}>
                      <td className="px-2 py-2">
                        <code>{record.product_id}</code>
                      </td>
                      <td className="px-2 py-2">{record.slug}</td>
                      <td className="px-2 py-2">{renderLatestVersion(record)}</td>
                      <td className="px-2 py-2">{record.published_tenants_count}</td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-x-1 gap-y-1">
                          <Link
                            className="text-primary underline underline-offset-4 hover:no-underline"
                            href={`/admin/products/${encodeURIComponent(record.product_id)}`}
                          >
                            Open
                          </Link>
                          <span aria-hidden="true" className="text-muted-foreground">
                            |
                          </span>
                          <Link
                            className="text-primary underline underline-offset-4 hover:no-underline"
                            href={`/p/${encodeURIComponent(record.slug)}`}
                          >
                            Public
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-2 py-4 text-muted-foreground" colSpan={5}>
                      No products found.
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

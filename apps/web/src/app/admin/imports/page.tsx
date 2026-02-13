import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "../../../components/ui/card";
import {
  listImports,
  normalizeImportListStatusFilter,
  type ImportListRecord,
  type ImportListStatusFilter
} from "../../../lib/admin/imports";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "../../../lib/admin/session";

type SearchParams = {
  q?: string | string[];
  status?: string | string[];
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

const readFilters = async (
  searchParams: PageProps["searchParams"]
): Promise<{ q: string | null; status: ImportListStatusFilter | null }> => {
  if (!searchParams) {
    return { q: null, status: null };
  }

  const resolved = await Promise.resolve(searchParams);
  return {
    q: asSingleValue(resolved.q),
    status: normalizeImportListStatusFilter(asSingleValue(resolved.status))
  };
};

const formatImportStatus = (status: ImportListRecord["status"]): string => {
  if (status === "processed") {
    return "converted";
  }

  return status;
};

export default async function AdminImportsPage({ searchParams }: PageProps) {
  const cookieStore = await cookies();
  const session = await verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    redirect("/admin/login");
  }

  const filters = await readFilters(searchParams);
  let records: ImportListRecord[] = [];
  let loadError: string | null = null;

  try {
    records = await listImports({
      q: filters.q,
      status: filters.status
    });
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unable to load imports.";
  }

  return (
    <section className="mx-auto flex w-full flex-col gap-6 py-2">
      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Imports</CardTitle>
            <CardDescription>
              Review uploaded import bundles and open conversion detail pages.
            </CardDescription>
          </div>
          <Button asChild type="button">
            <Link href="/admin/imports/new">Create import bundle</Link>
          </Button>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>
            Search by import ID or source_test_id and optionally filter by status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px_auto_auto]" method="get">
            <label className="space-y-1">
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                q
              </span>
              <input
                className="w-full rounded border bg-background px-2 py-2 text-sm"
                defaultValue={filters.q ?? ""}
                name="q"
                placeholder="import_id or source_test_id"
                type="search"
              />
            </label>

            <label className="space-y-1">
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                status
              </span>
              <select
                className="w-full rounded border bg-background px-2 py-2 text-sm"
                defaultValue={filters.status ?? ""}
                name="status"
              >
                <option value="">all</option>
                <option value="uploaded">uploaded</option>
                <option value="converted">converted</option>
                <option value="failed">failed</option>
              </select>
            </label>

            <Button className="self-end" type="submit" variant="secondary">
              Apply filters
            </Button>
            <Button asChild className="self-end" type="button" variant="outline">
              <Link href="/admin/imports">Clear</Link>
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent imports</CardTitle>
          <CardDescription>Most recent first.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadError ? (
            <p className="text-sm text-red-700" role="alert">
              Failed to load imports: {loadError}
            </p>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 font-semibold">import_id</th>
                  <th className="px-2 py-2 font-semibold">source_test_id</th>
                  <th className="px-2 py-2 font-semibold">locales</th>
                  <th className="px-2 py-2 font-semibold">status</th>
                  <th className="px-2 py-2 font-semibold">created_at</th>
                  <th className="px-2 py-2 font-semibold">created_by</th>
                  <th className="px-2 py-2 font-semibold">link</th>
                </tr>
              </thead>
              <tbody>
                {records.length > 0 ? (
                  records.map((record) => (
                    <tr className="border-b align-top" key={record.id}>
                      <td className="px-2 py-2">
                        <code className="break-all">{record.id}</code>
                      </td>
                      <td className="px-2 py-2">{record.source_test_id ?? ""}</td>
                      <td className="px-2 py-2">
                        {record.locales.length > 0 ? record.locales.join(", ") : ""}
                      </td>
                      <td className="px-2 py-2">{formatImportStatus(record.status)}</td>
                      <td className="px-2 py-2">{record.created_at}</td>
                      <td className="px-2 py-2">{record.created_by ?? ""}</td>
                      <td className="px-2 py-2">
                        <Link
                          className="text-primary underline underline-offset-4 hover:no-underline"
                          href={`/admin/imports/${record.id}`}
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-2 py-4 text-muted-foreground" colSpan={7}>
                      No imports found.
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

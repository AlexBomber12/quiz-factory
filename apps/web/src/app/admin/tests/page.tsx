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
import { listAdminTests, type AdminTestListRecord } from "../../../lib/admin/tests";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "../../../lib/admin/session";

type SearchParams = {
  q?: string | string[];
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
): Promise<{ q: string | null }> => {
  if (!searchParams) {
    return { q: null };
  }

  const resolved = await Promise.resolve(searchParams);
  return {
    q: asSingleValue(resolved.q)
  };
};

const renderLatestVersion = (record: AdminTestListRecord) => {
  if (record.latest_version !== null) {
    return `v${record.latest_version}`;
  }

  if (record.latest_version_id) {
    return <code className="break-all">{record.latest_version_id}</code>;
  }

  return "";
};

export default async function AdminTestsPage({ searchParams }: PageProps) {
  const cookieStore = await cookies();
  const session = await verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    redirect("/admin/login");
  }

  const filters = await readFilters(searchParams);
  let records: AdminTestListRecord[] = [];
  let loadError: string | null = null;

  try {
    records = await listAdminTests({
      q: filters.q
    });
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unable to load tests.";
  }

  return (
    <section className="mx-auto flex w-full flex-col gap-6 py-2">
      <Card>
        <CardHeader>
          <CardTitle>Tests registry</CardTitle>
          <CardDescription>
            Review known tests, latest versions, locale coverage, and publication footprint.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter</CardTitle>
          <CardDescription>Search by test_id or slug.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]" method="get">
            <label className="space-y-1">
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                q
              </span>
              <input
                className="w-full rounded border bg-background px-2 py-2 text-sm"
                defaultValue={filters.q ?? ""}
                name="q"
                placeholder="test_id or slug"
                type="search"
              />
            </label>

            <Button className="self-end" type="submit" variant="secondary">
              Apply filter
            </Button>
            <Button asChild className="self-end" type="button" variant="outline">
              <Link href="/admin/tests">Clear</Link>
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tests</CardTitle>
          <CardDescription>Most recently updated first.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadError ? (
            <p className="text-sm text-red-700" role="alert">
              Failed to load tests: {loadError}
            </p>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 font-semibold">test_id</th>
                  <th className="px-2 py-2 font-semibold">slug</th>
                  <th className="px-2 py-2 font-semibold">latest version</th>
                  <th className="px-2 py-2 font-semibold">locales</th>
                  <th className="px-2 py-2 font-semibold">published tenants</th>
                  <th className="px-2 py-2 font-semibold">actions</th>
                </tr>
              </thead>
              <tbody>
                {records.length > 0 ? (
                  records.map((record) => (
                    <tr className="border-b align-top" key={record.test_id}>
                      <td className="px-2 py-2">
                        <code>{record.test_id}</code>
                      </td>
                      <td className="px-2 py-2">{record.slug}</td>
                      <td className="px-2 py-2">{renderLatestVersion(record)}</td>
                      <td className="px-2 py-2">
                        {record.locales.length > 0 ? record.locales.join(", ") : ""}
                      </td>
                      <td className="px-2 py-2">{record.published_tenants_count}</td>
                      <td className="px-2 py-2">
                        <Link
                          className="text-primary underline underline-offset-4 hover:no-underline"
                          href={`/admin/tests/${encodeURIComponent(record.test_id)}`}
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-2 py-4 text-muted-foreground" colSpan={6}>
                      No tests found.
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

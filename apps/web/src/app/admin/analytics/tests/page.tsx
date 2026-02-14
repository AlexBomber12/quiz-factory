import { headers } from "next/headers";
import Link from "next/link";

import AdminAnalyticsPageScaffold from "../../../../components/admin/analytics/PageScaffold";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Input } from "../../../../components/ui/input";
import type { AdminAnalyticsTestsResponse, AdminAnalyticsTestsRow } from "../../../../lib/admin_analytics/types";

type SearchParams = Record<string, string | string[] | undefined>;

type PageProps = {
  searchParams?: SearchParams | Promise<SearchParams>;
};

const FILTER_KEYS = [
  "start",
  "end",
  "tenant_id",
  "test_id",
  "locale",
  "device_type",
  "utm_source"
] as const;
const QUERY_KEYS = [...FILTER_KEYS, "q", "top_tenant_id", "sort", "dir"] as const;
const SORT_FIELDS = [
  "test_id",
  "sessions",
  "starts",
  "completes",
  "purchases",
  "paid_conversion",
  "net_revenue_eur",
  "refunds_eur",
  "last_activity_date"
] as const;

type TestSortField = (typeof SORT_FIELDS)[number];
type SortDirection = "asc" | "desc";

const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const asSingleValue = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

const resolveSearchParams = async (
  searchParams: PageProps["searchParams"]
): Promise<SearchParams> => {
  if (!searchParams) {
    return {};
  }

  return Promise.resolve(searchParams);
};

const buildQueryString = (resolved: SearchParams, keys: readonly string[]): string => {
  const params = new URLSearchParams();

  for (const key of keys) {
    const value = asSingleValue(resolved[key]);
    const normalized = value?.trim() ?? "";
    if (!normalized) {
      continue;
    }

    params.set(key, normalized);
  }

  return params.toString();
};

const readOrigin = async (): Promise<{ origin: string; cookieHeader: string | null }> => {
  const headerStore = await headers();
  const host = (headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "").trim();
  const forwardedProto = (headerStore.get("x-forwarded-proto") ?? "").split(",")[0]?.trim();
  const protocol = forwardedProto || (process.env.NODE_ENV === "development" ? "http" : "https");

  if (host.length > 0) {
    return {
      origin: `${protocol}://${host}`,
      cookieHeader: headerStore.get("cookie")
    };
  }

  return {
    origin: "http://localhost:3000",
    cookieHeader: headerStore.get("cookie")
  };
};

const fetchTests = async (
  resolvedSearchParams: SearchParams
): Promise<{ payload: AdminAnalyticsTestsResponse | null; error: string | null }> => {
  const queryString = buildQueryString(resolvedSearchParams, FILTER_KEYS);
  const { origin, cookieHeader } = await readOrigin();
  const requestUrl = queryString
    ? `${origin}/api/admin/analytics/tests?${queryString}`
    : `${origin}/api/admin/analytics/tests`;

  try {
    const response = await fetch(requestUrl, {
      method: "GET",
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined
    });

    if (!response.ok) {
      return {
        payload: null,
        error: `Tests request failed with status ${response.status}.`
      };
    }

    return {
      payload: (await response.json()) as AdminAnalyticsTestsResponse,
      error: null
    };
  } catch (error) {
    return {
      payload: null,
      error: error instanceof Error ? error.message : "Failed to load tests analytics."
    };
  }
};

const normalizeSortField = (value: string | null): TestSortField => {
  if (value && SORT_FIELDS.includes(value as TestSortField)) {
    return value as TestSortField;
  }

  return "net_revenue_eur";
};

const normalizeSortDirection = (value: string | null): SortDirection => {
  return value === "asc" ? "asc" : "desc";
};

const readSort = (resolvedSearchParams: SearchParams): { field: TestSortField; direction: SortDirection } => {
  const sortField = normalizeSortField(asSingleValue(resolvedSearchParams.sort));
  const sortDirection = normalizeSortDirection(asSingleValue(resolvedSearchParams.dir));

  return {
    field: sortField,
    direction: sortDirection
  };
};

const applySearchFilters = (
  rows: AdminAnalyticsTestsRow[],
  resolvedSearchParams: SearchParams
): AdminAnalyticsTestsRow[] => {
  const query = (asSingleValue(resolvedSearchParams.q) ?? "").trim().toLowerCase();
  const topTenantId = (asSingleValue(resolvedSearchParams.top_tenant_id) ?? "").trim();

  return rows.filter((row) => {
    if (topTenantId && row.top_tenant_id !== topTenantId) {
      return false;
    }

    if (!query) {
      return true;
    }

    const haystack = [row.test_id, row.slug ?? "", row.top_tenant_id ?? ""].join(" ").toLowerCase();
    return haystack.includes(query);
  });
};

const compareNullableStrings = (left: string | null, right: string | null): number => {
  return (left ?? "").localeCompare(right ?? "");
};

const sortRows = (
  rows: AdminAnalyticsTestsRow[],
  field: TestSortField,
  direction: SortDirection
): AdminAnalyticsTestsRow[] => {
  const sorted = [...rows].sort((left, right) => {
    let comparison = 0;

    switch (field) {
      case "test_id":
        comparison = left.test_id.localeCompare(right.test_id);
        break;
      case "last_activity_date":
        comparison = compareNullableStrings(left.last_activity_date, right.last_activity_date);
        break;
      case "sessions":
        comparison = Number(left.sessions) - Number(right.sessions);
        break;
      case "starts":
        comparison = Number(left.starts) - Number(right.starts);
        break;
      case "completes":
        comparison = Number(left.completes) - Number(right.completes);
        break;
      case "purchases":
        comparison = Number(left.purchases) - Number(right.purchases);
        break;
      case "paid_conversion":
        comparison = Number(left.paid_conversion) - Number(right.paid_conversion);
        break;
      case "net_revenue_eur":
        comparison = Number(left.net_revenue_eur) - Number(right.net_revenue_eur);
        break;
      case "refunds_eur":
        comparison = Number(left.refunds_eur) - Number(right.refunds_eur);
        break;
      default:
        comparison = 0;
    }

    if (comparison === 0) {
      return left.test_id.localeCompare(right.test_id);
    }

    return direction === "asc" ? comparison : -comparison;
  });

  return sorted;
};

const buildSortHref = (
  currentQueryString: string,
  currentField: TestSortField,
  currentDirection: SortDirection,
  targetField: TestSortField
): string => {
  const nextQuery = new URLSearchParams(currentQueryString);
  const nextDirection: SortDirection = currentField === targetField && currentDirection === "desc"
    ? "asc"
    : "desc";
  nextQuery.set("sort", targetField);
  nextQuery.set("dir", nextDirection);

  const queryString = nextQuery.toString();
  return queryString ? `/admin/analytics/tests?${queryString}` : "/admin/analytics/tests";
};

const getSortIndicator = (
  currentField: TestSortField,
  currentDirection: SortDirection,
  targetField: TestSortField
): string => {
  if (currentField !== targetField) {
    return "";
  }

  return currentDirection === "asc" ? " ↑" : " ↓";
};

const formatUtcDate = (value: string | null): string => {
  if (!value) {
    return "N/A";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toISOString();
};

export default async function AdminAnalyticsTestsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const { field, direction } = readSort(resolvedSearchParams);
  const queryString = buildQueryString(resolvedSearchParams, QUERY_KEYS);
  const detailFilterQueryString = buildQueryString(resolvedSearchParams, FILTER_KEYS);
  const resetHref = detailFilterQueryString ? `/admin/analytics/tests?${detailFilterQueryString}` : "/admin/analytics/tests";
  const { payload, error } = await fetchTests(resolvedSearchParams);
  const filteredRows = applySearchFilters(payload?.rows ?? [], resolvedSearchParams);
  const rows = sortRows(filteredRows, field, direction);
  const hasSlugColumn = rows.some((row) => typeof row.slug === "string" && row.slug.trim().length > 0);
  const searchQuery = asSingleValue(resolvedSearchParams.q) ?? "";
  const topTenantId = asSingleValue(resolvedSearchParams.top_tenant_id) ?? "";

  return (
    <AdminAnalyticsPageScaffold
      description="Tests-level analytics list from mart_funnel_daily and mart_pnl_daily."
      links={[
        { href: "/admin/analytics", label: "Back to analytics overview" },
        { href: "/admin/analytics/distribution", label: "Open distribution matrix" }
      ]}
      title="Tests analytics"
    >
      {error ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Load error</CardTitle>
            <CardDescription>Unable to fetch tests analytics list.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Search and filters</CardTitle>
          <CardDescription>Filter the loaded test rows by query text or top tenant_id.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/admin/analytics/tests" className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]" method="get">
            {FILTER_KEYS.map((key) => {
              const value = asSingleValue(resolvedSearchParams[key]);
              if (!value || value.trim().length === 0) {
                return null;
              }

              return <input key={key} name={key} type="hidden" value={value} />;
            })}
            <label className="space-y-1">
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                search
              </span>
              <Input defaultValue={searchQuery} name="q" placeholder="test_id, slug, tenant" type="text" />
            </label>
            <label className="space-y-1">
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                top_tenant_id
              </span>
              <Input defaultValue={topTenantId} name="top_tenant_id" placeholder="tenant-..." type="text" />
            </label>
            <div className="flex items-end">
              <Button type="submit" variant="secondary">Apply</Button>
            </div>
            <div className="flex items-end">
              <Button asChild type="button" variant="outline">
                <Link href={resetHref}>Reset</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tests table</CardTitle>
          <CardDescription>
            {payload
              ? `Generated at ${formatUtcDate(payload.generated_at_utc)}. Showing ${rows.length} tests after local search/filter.`
              : "No tests payload loaded."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 font-semibold">
                    <Link
                      className="underline underline-offset-4 hover:no-underline"
                      href={buildSortHref(queryString, field, direction, "test_id")}
                    >
                      test_id{getSortIndicator(field, direction, "test_id")}
                    </Link>
                  </th>
                  {hasSlugColumn ? <th className="px-2 py-2 font-semibold">slug</th> : null}
                  <th className="px-2 py-2 font-semibold">
                    <Link
                      className="underline underline-offset-4 hover:no-underline"
                      href={buildSortHref(queryString, field, direction, "sessions")}
                    >
                      sessions{getSortIndicator(field, direction, "sessions")}
                    </Link>
                  </th>
                  <th className="px-2 py-2 font-semibold">
                    <Link
                      className="underline underline-offset-4 hover:no-underline"
                      href={buildSortHref(queryString, field, direction, "starts")}
                    >
                      starts{getSortIndicator(field, direction, "starts")}
                    </Link>
                  </th>
                  <th className="px-2 py-2 font-semibold">
                    <Link
                      className="underline underline-offset-4 hover:no-underline"
                      href={buildSortHref(queryString, field, direction, "completes")}
                    >
                      completes{getSortIndicator(field, direction, "completes")}
                    </Link>
                  </th>
                  <th className="px-2 py-2 font-semibold">
                    <Link
                      className="underline underline-offset-4 hover:no-underline"
                      href={buildSortHref(queryString, field, direction, "purchases")}
                    >
                      purchases{getSortIndicator(field, direction, "purchases")}
                    </Link>
                  </th>
                  <th className="px-2 py-2 font-semibold">
                    <Link
                      className="underline underline-offset-4 hover:no-underline"
                      href={buildSortHref(queryString, field, direction, "paid_conversion")}
                    >
                      paid conversion{getSortIndicator(field, direction, "paid_conversion")}
                    </Link>
                  </th>
                  <th className="px-2 py-2 font-semibold">
                    <Link
                      className="underline underline-offset-4 hover:no-underline"
                      href={buildSortHref(queryString, field, direction, "net_revenue_eur")}
                    >
                      net revenue{getSortIndicator(field, direction, "net_revenue_eur")}
                    </Link>
                  </th>
                  <th className="px-2 py-2 font-semibold">
                    <Link
                      className="underline underline-offset-4 hover:no-underline"
                      href={buildSortHref(queryString, field, direction, "refunds_eur")}
                    >
                      refunds{getSortIndicator(field, direction, "refunds_eur")}
                    </Link>
                  </th>
                  <th className="px-2 py-2 font-semibold">top_tenant_id</th>
                  <th className="px-2 py-2 font-semibold">
                    <Link
                      className="underline underline-offset-4 hover:no-underline"
                      href={buildSortHref(queryString, field, direction, "last_activity_date")}
                    >
                      last activity{getSortIndicator(field, direction, "last_activity_date")}
                    </Link>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const href = detailFilterQueryString
                    ? `/admin/analytics/tests/${encodeURIComponent(row.test_id)}?${detailFilterQueryString}`
                    : `/admin/analytics/tests/${encodeURIComponent(row.test_id)}`;

                  return (
                    <tr className="border-b align-top" key={row.test_id}>
                      <td className="px-2 py-2">
                        <Link className="text-primary underline underline-offset-4 hover:no-underline" href={href}>
                          <code>{row.test_id}</code>
                        </Link>
                      </td>
                      {hasSlugColumn ? <td className="px-2 py-2">{row.slug ?? "N/A"}</td> : null}
                      <td className="px-2 py-2">{numberFormatter.format(Number(row.sessions))}</td>
                      <td className="px-2 py-2">{numberFormatter.format(Number(row.starts))}</td>
                      <td className="px-2 py-2">{numberFormatter.format(Number(row.completes))}</td>
                      <td className="px-2 py-2">{numberFormatter.format(Number(row.purchases))}</td>
                      <td className="px-2 py-2">{percentFormatter.format(Number(row.paid_conversion))}</td>
                      <td className="px-2 py-2">{currencyFormatter.format(Number(row.net_revenue_eur))}</td>
                      <td className="px-2 py-2">{currencyFormatter.format(Number(row.refunds_eur))}</td>
                      <td className="px-2 py-2">{row.top_tenant_id ? <code>{row.top_tenant_id}</code> : "N/A"}</td>
                      <td className="px-2 py-2">{row.last_activity_date ?? "N/A"}</td>
                    </tr>
                  );
                })}
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-2 py-4 text-muted-foreground" colSpan={hasSlugColumn ? 11 : 10}>
                      No test rows for the selected filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </AdminAnalyticsPageScaffold>
  );
}

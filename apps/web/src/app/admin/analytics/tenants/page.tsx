import { headers } from "next/headers";
import Link from "next/link";

import AdminAnalyticsPageScaffold from "../../../../components/admin/analytics/PageScaffold";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import type { AdminAnalyticsTenantsResponse, AdminAnalyticsTenantsRow } from "../../../../lib/admin_analytics/types";

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
const QUERY_KEYS = [...FILTER_KEYS, "sort", "dir"] as const;
const SORT_FIELDS = [
  "tenant_id",
  "sessions",
  "test_starts",
  "test_completes",
  "purchases",
  "paid_conversion",
  "net_revenue_eur",
  "refunds_eur",
  "last_activity_date"
] as const;

type TenantSortField = (typeof SORT_FIELDS)[number];
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

const fetchTenants = async (
  resolvedSearchParams: SearchParams
): Promise<{ payload: AdminAnalyticsTenantsResponse | null; error: string | null }> => {
  const queryString = buildQueryString(resolvedSearchParams, FILTER_KEYS);
  const { origin, cookieHeader } = await readOrigin();
  const requestUrl = queryString
    ? `${origin}/api/admin/analytics/tenants?${queryString}`
    : `${origin}/api/admin/analytics/tenants`;

  try {
    const response = await fetch(requestUrl, {
      method: "GET",
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined
    });

    if (!response.ok) {
      return {
        payload: null,
        error: `Tenants request failed with status ${response.status}.`
      };
    }

    return {
      payload: (await response.json()) as AdminAnalyticsTenantsResponse,
      error: null
    };
  } catch (error) {
    return {
      payload: null,
      error: error instanceof Error ? error.message : "Failed to load tenants analytics."
    };
  }
};

const normalizeSortField = (value: string | null): TenantSortField => {
  if (value && SORT_FIELDS.includes(value as TenantSortField)) {
    return value as TenantSortField;
  }

  return "net_revenue_eur";
};

const normalizeSortDirection = (value: string | null): SortDirection => {
  return value === "asc" ? "asc" : "desc";
};

const readSort = (resolvedSearchParams: SearchParams): { field: TenantSortField; direction: SortDirection } => {
  const sortField = normalizeSortField(asSingleValue(resolvedSearchParams.sort));
  const sortDirection = normalizeSortDirection(asSingleValue(resolvedSearchParams.dir));

  return {
    field: sortField,
    direction: sortDirection
  };
};

const compareNullableStrings = (left: string | null, right: string | null): number => {
  return (left ?? "").localeCompare(right ?? "");
};

const sortRows = (
  rows: AdminAnalyticsTenantsRow[],
  field: TenantSortField,
  direction: SortDirection
): AdminAnalyticsTenantsRow[] => {
  const sorted = [...rows].sort((left, right) => {
    let comparison = 0;

    switch (field) {
      case "tenant_id":
        comparison = left.tenant_id.localeCompare(right.tenant_id);
        break;
      case "last_activity_date":
        comparison = compareNullableStrings(left.last_activity_date, right.last_activity_date);
        break;
      case "sessions":
        comparison = Number(left.sessions) - Number(right.sessions);
        break;
      case "test_starts":
        comparison = Number(left.test_starts) - Number(right.test_starts);
        break;
      case "test_completes":
        comparison = Number(left.test_completes) - Number(right.test_completes);
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
      return left.tenant_id.localeCompare(right.tenant_id);
    }

    return direction === "asc" ? comparison : -comparison;
  });

  return sorted;
};

const buildSortHref = (
  currentQueryString: string,
  currentField: TenantSortField,
  currentDirection: SortDirection,
  targetField: TenantSortField
): string => {
  const nextQuery = new URLSearchParams(currentQueryString);
  const nextDirection: SortDirection = currentField === targetField && currentDirection === "desc"
    ? "asc"
    : "desc";
  nextQuery.set("sort", targetField);
  nextQuery.set("dir", nextDirection);

  const queryString = nextQuery.toString();
  return queryString ? `/admin/analytics/tenants?${queryString}` : "/admin/analytics/tenants";
};

const getSortIndicator = (
  currentField: TenantSortField,
  currentDirection: SortDirection,
  targetField: TenantSortField
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

export default async function AdminAnalyticsTenantsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const { field, direction } = readSort(resolvedSearchParams);
  const queryString = buildQueryString(resolvedSearchParams, QUERY_KEYS);
  const detailFilterQueryString = buildQueryString(resolvedSearchParams, FILTER_KEYS);
  const { payload, error } = await fetchTenants(resolvedSearchParams);
  const rows = sortRows(payload?.rows ?? [], field, direction);

  return (
    <AdminAnalyticsPageScaffold
      description="Tenant-level analytics list powered by mart_funnel_daily and mart_pnl_daily."
      links={[
        { href: "/admin/analytics", label: "Back to analytics overview" },
        { href: "/admin/analytics/distribution", label: "Open distribution matrix" }
      ]}
      title="Tenants analytics"
    >
      {error ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Load error</CardTitle>
            <CardDescription>Unable to fetch tenant analytics list.</CardDescription>
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
          <CardTitle className="text-base">Tenants table</CardTitle>
          <CardDescription>
            {payload
              ? `Generated at ${formatUtcDate(payload.generated_at_utc)}. Showing ${rows.length} of ${payload.total_rows} tenants.`
              : "No tenants payload loaded."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 font-semibold">
                    <Link
                      className="underline underline-offset-4 hover:no-underline"
                      href={buildSortHref(queryString, field, direction, "tenant_id")}
                    >
                      tenant_id{getSortIndicator(field, direction, "tenant_id")}
                    </Link>
                  </th>
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
                      href={buildSortHref(queryString, field, direction, "test_starts")}
                    >
                      starts{getSortIndicator(field, direction, "test_starts")}
                    </Link>
                  </th>
                  <th className="px-2 py-2 font-semibold">
                    <Link
                      className="underline underline-offset-4 hover:no-underline"
                      href={buildSortHref(queryString, field, direction, "test_completes")}
                    >
                      completes{getSortIndicator(field, direction, "test_completes")}
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
                  <th className="px-2 py-2 font-semibold">top_test_id</th>
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
                    ? `/admin/analytics/tenants/${encodeURIComponent(row.tenant_id)}?${detailFilterQueryString}`
                    : `/admin/analytics/tenants/${encodeURIComponent(row.tenant_id)}`;

                  return (
                    <tr className="border-b align-top" key={row.tenant_id}>
                      <td className="px-2 py-2">
                        <Link className="text-primary underline underline-offset-4 hover:no-underline" href={href}>
                          <code>{row.tenant_id}</code>
                        </Link>
                      </td>
                      <td className="px-2 py-2">{numberFormatter.format(Number(row.sessions))}</td>
                      <td className="px-2 py-2">{numberFormatter.format(Number(row.test_starts))}</td>
                      <td className="px-2 py-2">{numberFormatter.format(Number(row.test_completes))}</td>
                      <td className="px-2 py-2">{numberFormatter.format(Number(row.purchases))}</td>
                      <td className="px-2 py-2">{percentFormatter.format(Number(row.paid_conversion))}</td>
                      <td className="px-2 py-2">{currencyFormatter.format(Number(row.net_revenue_eur))}</td>
                      <td className="px-2 py-2">{currencyFormatter.format(Number(row.refunds_eur))}</td>
                      <td className="px-2 py-2">
                        {row.top_test_id ? <code>{row.top_test_id}</code> : "N/A"}
                      </td>
                      <td className="px-2 py-2">{row.last_activity_date ?? "N/A"}</td>
                    </tr>
                  );
                })}
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-2 py-4 text-muted-foreground" colSpan={10}>
                      No tenant rows for the selected filters.
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

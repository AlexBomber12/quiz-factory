import { headers } from "next/headers";
import Link from "next/link";

import AdminAnalyticsPageScaffold from "../../../../components/admin/analytics/PageScaffold";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import type { AdminAnalyticsDistributionResponse } from "../../../../lib/admin_analytics/types";

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
const QUERY_KEYS = [...FILTER_KEYS, "top_tenants", "top_tests"] as const;

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

const fetchDistribution = async (
  resolvedSearchParams: SearchParams
): Promise<{ payload: AdminAnalyticsDistributionResponse | null; error: string | null }> => {
  const queryString = buildQueryString(resolvedSearchParams, QUERY_KEYS);
  const { origin, cookieHeader } = await readOrigin();
  const requestUrl = queryString
    ? `${origin}/api/admin/analytics/distribution?${queryString}`
    : `${origin}/api/admin/analytics/distribution`;

  try {
    const response = await fetch(requestUrl, {
      method: "GET",
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined
    });

    if (!response.ok) {
      return {
        payload: null,
        error: `Distribution request failed with status ${response.status}.`
      };
    }

    return {
      payload: (await response.json()) as AdminAnalyticsDistributionResponse,
      error: null
    };
  } catch (error) {
    return {
      payload: null,
      error: error instanceof Error ? error.message : "Failed to load distribution analytics."
    };
  }
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

const buildTenantDetailHref = (
  tenantId: string,
  resolvedSearchParams: SearchParams
): string => {
  const params = new URLSearchParams(buildQueryString(resolvedSearchParams, FILTER_KEYS));
  params.set("tenant_id", tenantId);
  const queryString = params.toString();
  const encodedTenantId = encodeURIComponent(tenantId);
  return queryString
    ? `/admin/analytics/tenants/${encodedTenantId}?${queryString}`
    : `/admin/analytics/tenants/${encodedTenantId}`;
};

const buildTestDetailHref = (
  testId: string,
  resolvedSearchParams: SearchParams
): string => {
  const params = new URLSearchParams(buildQueryString(resolvedSearchParams, FILTER_KEYS));
  params.set("test_id", testId);
  const queryString = params.toString();
  const encodedTestId = encodeURIComponent(testId);
  return queryString
    ? `/admin/analytics/tests/${encodedTestId}?${queryString}`
    : `/admin/analytics/tests/${encodedTestId}`;
};

const buildCellHref = (
  tenantId: string,
  testId: string,
  resolvedSearchParams: SearchParams
): string => {
  const params = new URLSearchParams(buildQueryString(resolvedSearchParams, FILTER_KEYS));
  params.set("tenant_id", tenantId);
  params.set("test_id", testId);
  const queryString = params.toString();
  const encodedTenantId = encodeURIComponent(tenantId);
  return queryString
    ? `/admin/analytics/tenants/${encodedTenantId}?${queryString}`
    : `/admin/analytics/tenants/${encodedTenantId}`;
};

export default async function AdminAnalyticsDistributionPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const { payload, error } = await fetchDistribution(resolvedSearchParams);
  const rowOrder = payload?.row_order ?? [];
  const columnOrder = payload?.column_order ?? [];

  return (
    <AdminAnalyticsPageScaffold
      description="Tenant x test publication and 7d quick metrics matrix."
      links={[
        { href: "/admin/analytics", label: "Back to analytics overview" },
        { href: "/admin/analytics/tests", label: "Open tests analytics" },
        { href: "/admin/analytics/tenants", label: "Open tenants analytics" }
      ]}
      title="Distribution matrix"
    >
      {error ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Load error</CardTitle>
            <CardDescription>Unable to fetch distribution matrix.</CardDescription>
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
          <CardTitle className="text-base">Matrix</CardTitle>
          <CardDescription>
            {payload
              ? `Generated at ${formatUtcDate(payload.generated_at_utc)}. Showing ${rowOrder.length} tenants x ${columnOrder.length} tests (top_tenants=${payload.top_tenants}, top_tests=${payload.top_tests}).`
              : "No matrix payload loaded."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full min-w-[1280px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="sticky left-0 top-0 z-30 bg-background px-3 py-2 font-semibold">
                    tenant_id
                  </th>
                  {columnOrder.map((testId) => (
                    <th className="sticky top-0 z-20 bg-background px-3 py-2 font-semibold" key={testId}>
                      <div className="space-y-1">
                        <Link
                          className="underline underline-offset-4 hover:no-underline"
                          href={buildTestDetailHref(testId, resolvedSearchParams)}
                        >
                          <code>{testId}</code>
                        </Link>
                        <p className="text-xs font-normal text-muted-foreground">
                          {currencyFormatter.format(payload?.columns[testId]?.net_revenue_eur_7d ?? 0)}
                        </p>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rowOrder.map((tenantId) => {
                  const row = payload?.rows[tenantId];
                  return (
                    <tr className="border-b align-top" key={tenantId}>
                      <th className="sticky left-0 z-10 bg-background px-3 py-3 font-semibold" scope="row">
                        <div className="space-y-1">
                          <Link
                            className="underline underline-offset-4 hover:no-underline"
                            href={buildTenantDetailHref(tenantId, resolvedSearchParams)}
                          >
                            <code>{tenantId}</code>
                          </Link>
                          <p className="text-xs font-normal text-muted-foreground">
                            {currencyFormatter.format(row?.net_revenue_eur_7d ?? 0)}
                          </p>
                        </div>
                      </th>
                      {columnOrder.map((testId) => {
                        const cell = row?.cells[testId];
                        if (!cell) {
                          return (
                            <td className="px-3 py-3" key={`${tenantId}:${testId}`}>
                              <p className="text-xs text-muted-foreground">No data</p>
                            </td>
                          );
                        }

                        return (
                          <td className="px-3 py-3" key={`${tenantId}:${testId}`}>
                            <Link
                              className="block rounded-md border bg-card p-3 transition-colors hover:bg-muted/50"
                              href={buildCellHref(tenantId, testId, resolvedSearchParams)}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className={`text-xs font-medium ${
                                    cell.is_published
                                      ? "text-emerald-700"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {cell.is_published ? "Published" : "Not published"}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {cell.enabled === null
                                    ? "enabled: n/a"
                                    : cell.enabled
                                      ? "enabled"
                                      : "disabled"}
                                </span>
                              </div>
                              <p className="mt-2 text-sm font-semibold">
                                {currencyFormatter.format(cell.net_revenue_eur_7d)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                paid conversion {percentFormatter.format(cell.paid_conversion_7d)}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {cell.version_id ? `version ${cell.version_id}` : "version n/a"}
                              </p>
                            </Link>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {rowOrder.length === 0 || columnOrder.length === 0 ? (
                  <tr>
                    <td
                      className="px-3 py-5 text-sm text-muted-foreground"
                      colSpan={Math.max(1, columnOrder.length + 1)}
                    >
                      No rows in the selected range. Adjust filters or lower top_tenants/top_tests.
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

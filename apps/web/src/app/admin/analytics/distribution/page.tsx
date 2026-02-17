import Link from "next/link";

import AdminChart from "../../../../components/admin/charts/AdminChart";
import { buildHeatmapOption } from "../../../../components/admin/charts/options";
import AdminAnalyticsPageScaffold from "../../../../components/admin/analytics/PageScaffold";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { getAdminAnalyticsProvider } from "../../../../lib/admin_analytics/provider";
import {
  ADMIN_ANALYTICS_DISTRIBUTION_DEFAULT_LIMIT,
  ADMIN_ANALYTICS_DISTRIBUTION_MAX_LIMIT,
  parseAdminAnalyticsFilters,
  type AdminAnalyticsDistributionOptions,
  type AdminAnalyticsDistributionResponse
} from "../../../../lib/admin_analytics/types";

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
const INTEGER_PATTERN = /^\d+$/;

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

const parseDistributionOptions = (
  searchParams: URLSearchParams
): { ok: true; value: AdminAnalyticsDistributionOptions } | { ok: false; error: string } => {
  const parseLimit = (value: string | null): number | null => {
    if (value === null || value.trim().length === 0) {
      return ADMIN_ANALYTICS_DISTRIBUTION_DEFAULT_LIMIT;
    }

    const normalized = value.trim();
    if (!INTEGER_PATTERN.test(normalized)) {
      return null;
    }

    const parsed = Number.parseInt(normalized, 10);
    if (
      !Number.isSafeInteger(parsed) ||
      parsed < 1 ||
      parsed > ADMIN_ANALYTICS_DISTRIBUTION_MAX_LIMIT
    ) {
      return null;
    }

    return parsed;
  };

  const topTenants = parseLimit(searchParams.get("top_tenants"));
  const topTests = parseLimit(searchParams.get("top_tests"));
  if (topTenants === null || topTests === null) {
    return {
      ok: false,
      error: `top_tenants and top_tests must be integers between 1 and ${ADMIN_ANALYTICS_DISTRIBUTION_MAX_LIMIT}.`
    };
  }

  return {
    ok: true,
    value: {
      top_tenants: topTenants,
      top_tests: topTests
    }
  };
};

const fetchDistribution = async (
  resolvedSearchParams: SearchParams
): Promise<{ payload: AdminAnalyticsDistributionResponse | null; error: string | null }> => {
  const queryString = buildQueryString(resolvedSearchParams, QUERY_KEYS);
  const searchParams = new URLSearchParams(queryString);
  const parsedFilters = parseAdminAnalyticsFilters(searchParams);
  if (!parsedFilters.ok) {
    return {
      payload: null,
      error: "Invalid analytics filters."
    };
  }
  const parsedOptions = parseDistributionOptions(searchParams);
  if (!parsedOptions.ok) {
    return {
      payload: null,
      error: parsedOptions.error
    };
  }

  try {
    const provider = getAdminAnalyticsProvider();
    return {
      payload: await provider.getDistribution(parsedFilters.value, parsedOptions.value),
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

const buildDistributionHeatmapOption = (
  payload: AdminAnalyticsDistributionResponse | null
) => {
  const rowOrder = payload?.row_order ?? [];
  const columnOrder = payload?.column_order ?? [];
  const points = rowOrder.flatMap((tenantId) => {
    const row = payload?.rows[tenantId];
    if (!row) {
      return [];
    }

    return columnOrder
      .map((testId) => {
        const cell = row.cells[testId];
        if (!cell) {
          return null;
        }

        return {
          x: testId,
          y: tenantId,
          value: cell.net_revenue_eur_7d
        };
      })
      .filter((point): point is { x: string; y: string; value: number } => point !== null);
  });

  return buildHeatmapOption({
    xLabels: columnOrder,
    yLabels: rowOrder,
    points,
    emptyMessage: "No matrix cells available for the selected filters."
  });
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
          <CardTitle className="text-base">Distribution heatmap</CardTitle>
          <CardDescription>
            Tenant x test matrix visualized by 7-day net revenue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminChart option={buildDistributionHeatmapOption(payload)} />
        </CardContent>
      </Card>

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

import { headers } from "next/headers";
import Link from "next/link";

import AdminChart from "../../../../components/admin/charts/AdminChart";
import { buildStackedBarOption } from "../../../../components/admin/charts/options";
import AdminAnalyticsPageScaffold from "../../../../components/admin/analytics/PageScaffold";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import type {
  AdminAnalyticsTrafficResponse,
  AdminAnalyticsTrafficSegmentRow,
  KpiCard
} from "../../../../lib/admin_analytics/types";
import {
  ADMIN_ANALYTICS_TRAFFIC_DEFAULT_LIMIT,
  ADMIN_ANALYTICS_TRAFFIC_MAX_LIMIT
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
const REQUEST_KEYS = [...FILTER_KEYS, "top_n"] as const;
const QUERY_KEYS = [...REQUEST_KEYS, "sort", "dir"] as const;
const SORT_FIELDS = ["segment", "sessions", "purchases", "paid_conversion", "net_revenue_eur"] as const;

type TrafficSortField = (typeof SORT_FIELDS)[number];
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

const normalizeTopN = (value: string | null): number => {
  if (!value || !/^\d+$/.test(value.trim())) {
    return ADMIN_ANALYTICS_TRAFFIC_DEFAULT_LIMIT;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed)) {
    return ADMIN_ANALYTICS_TRAFFIC_DEFAULT_LIMIT;
  }

  if (parsed < 1) {
    return 1;
  }

  return Math.min(parsed, ADMIN_ANALYTICS_TRAFFIC_MAX_LIMIT);
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

const fetchTraffic = async (
  resolvedSearchParams: SearchParams
): Promise<{ payload: AdminAnalyticsTrafficResponse | null; error: string | null }> => {
  const queryString = buildQueryString(resolvedSearchParams, REQUEST_KEYS);
  const { origin, cookieHeader } = await readOrigin();
  const requestUrl = queryString
    ? `${origin}/api/admin/analytics/traffic?${queryString}`
    : `${origin}/api/admin/analytics/traffic`;

  try {
    const response = await fetch(requestUrl, {
      method: "GET",
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined
    });

    if (!response.ok) {
      return {
        payload: null,
        error: `Traffic request failed with status ${response.status}.`
      };
    }

    return {
      payload: (await response.json()) as AdminAnalyticsTrafficResponse,
      error: null
    };
  } catch (error) {
    return {
      payload: null,
      error: error instanceof Error ? error.message : "Failed to load traffic analytics."
    };
  }
};

const normalizeSortField = (value: string | null): TrafficSortField => {
  if (value && SORT_FIELDS.includes(value as TrafficSortField)) {
    return value as TrafficSortField;
  }

  return "sessions";
};

const normalizeSortDirection = (value: string | null): SortDirection => {
  return value === "asc" ? "asc" : "desc";
};

const readSort = (resolvedSearchParams: SearchParams): { field: TrafficSortField; direction: SortDirection } => {
  return {
    field: normalizeSortField(asSingleValue(resolvedSearchParams.sort)),
    direction: normalizeSortDirection(asSingleValue(resolvedSearchParams.dir))
  };
};

const sortRows = (
  rows: AdminAnalyticsTrafficSegmentRow[],
  field: TrafficSortField,
  direction: SortDirection
): AdminAnalyticsTrafficSegmentRow[] => {
  const sorted = [...rows].sort((left, right) => {
    let comparison = 0;

    switch (field) {
      case "segment":
        comparison = left.segment.localeCompare(right.segment);
        break;
      case "sessions":
        comparison = Number(left.sessions) - Number(right.sessions);
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
      default:
        comparison = 0;
    }

    if (comparison === 0) {
      return left.segment.localeCompare(right.segment);
    }

    return direction === "asc" ? comparison : -comparison;
  });

  return sorted;
};

const buildSortHref = (
  currentQueryString: string,
  currentField: TrafficSortField,
  currentDirection: SortDirection,
  targetField: TrafficSortField
): string => {
  const nextQuery = new URLSearchParams(currentQueryString);
  const nextDirection: SortDirection = currentField === targetField && currentDirection === "desc"
    ? "asc"
    : "desc";
  nextQuery.set("sort", targetField);
  nextQuery.set("dir", nextDirection);

  const queryString = nextQuery.toString();
  return queryString ? `/admin/analytics/traffic?${queryString}` : "/admin/analytics/traffic";
};

const buildTopNHref = (
  currentQueryString: string,
  topN: number
): string => {
  const nextQuery = new URLSearchParams(currentQueryString);
  nextQuery.set("top_n", String(topN));

  const queryString = nextQuery.toString();
  return queryString ? `/admin/analytics/traffic?${queryString}` : "/admin/analytics/traffic";
};

const getSortIndicator = (
  currentField: TrafficSortField,
  currentDirection: SortDirection,
  targetField: TrafficSortField
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

const formatKpiValue = (kpi: KpiCard): string => {
  switch (kpi.unit) {
    case "currency_eur":
      return currencyFormatter.format(kpi.value);
    case "ratio":
    case "percent":
      return percentFormatter.format(kpi.value);
    case "count":
    default:
      return numberFormatter.format(kpi.value);
  }
};

const renderTrafficTable = (
  rows: AdminAnalyticsTrafficSegmentRow[],
  title: string,
  description: string,
  queryString: string,
  field: TrafficSortField,
  direction: SortDirection
) => {
  const chartRows = rows.slice(0, 25);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>
          {description} Chart preview shows the top {Math.min(chartRows.length, 25)} segments by the active sort.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <AdminChart
          option={buildStackedBarOption({
            categories: chartRows.map((row) => row.segment),
            series: [
              {
                name: "Sessions",
                values: chartRows.map((row) => row.sessions),
                color: "#0284c7"
              },
              {
                name: "Purchases",
                values: chartRows.map((row) => row.purchases),
                color: "#0f766e"
              }
            ],
            emptyMessage: "No rows available for the selected filters."
          })}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-2 py-2 font-semibold">
                  <Link
                    className="underline underline-offset-4 hover:no-underline"
                    href={buildSortHref(queryString, field, direction, "segment")}
                  >
                    segment{getSortIndicator(field, direction, "segment")}
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
                    paid_conversion{getSortIndicator(field, direction, "paid_conversion")}
                  </Link>
                </th>
                <th className="px-2 py-2 font-semibold">
                  <Link
                    className="underline underline-offset-4 hover:no-underline"
                    href={buildSortHref(queryString, field, direction, "net_revenue_eur")}
                  >
                    net_revenue_eur{getSortIndicator(field, direction, "net_revenue_eur")}
                  </Link>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr className="border-b align-top" key={`${title}:${row.segment}`}>
                  <td className="px-2 py-2">{row.segment}</td>
                  <td className="px-2 py-2">{numberFormatter.format(row.sessions)}</td>
                  <td className="px-2 py-2">{numberFormatter.format(row.purchases)}</td>
                  <td className="px-2 py-2">{percentFormatter.format(row.paid_conversion)}</td>
                  <td className="px-2 py-2">{currencyFormatter.format(row.net_revenue_eur)}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="px-2 py-4 text-muted-foreground" colSpan={5}>
                    No rows available for the selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default async function AdminAnalyticsTrafficPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const { field, direction } = readSort(resolvedSearchParams);
  const queryString = buildQueryString(resolvedSearchParams, QUERY_KEYS);
  const { payload, error } = await fetchTraffic(resolvedSearchParams);
  const topN = payload?.top_n ?? normalizeTopN(asSingleValue(resolvedSearchParams.top_n));

  const sources = sortRows(payload?.by_utm_source ?? [], field, direction);
  const campaigns = sortRows(payload?.by_utm_campaign ?? [], field, direction);
  const referrers = sortRows(payload?.by_referrer ?? [], field, direction);
  const devices = sortRows(payload?.by_device_type ?? [], field, direction);
  const countries = sortRows(payload?.by_country ?? [], field, direction);

  return (
    <AdminAnalyticsPageScaffold
      description="Traffic analytics by source, campaign, device, referrer, and country (when available)."
      links={[
        { href: "/admin/analytics", label: "Back to analytics overview" },
        { href: "/admin/analytics/tenants", label: "Open tenants analytics" },
        { href: "/admin/analytics/tests", label: "Open tests analytics" }
      ]}
      title="Traffic analytics"
    >
      {error ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Load error</CardTitle>
            <CardDescription>Unable to fetch traffic analytics.</CardDescription>
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
          <CardTitle className="text-base">Table controls</CardTitle>
          <CardDescription>
            {payload
              ? `Generated at ${formatUtcDate(payload.generated_at_utc)}. Showing top ${payload.top_n} rows per section.`
              : `Showing top ${topN} rows per section.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-sm">
          {[25, 50, 100, 200].map((value) => (
            <Link
              className="rounded-md border bg-card px-3 py-1.5 hover:bg-muted/60"
              href={buildTopNHref(queryString, value)}
              key={value}
            >
              top_n={value}
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">KPI summary</CardTitle>
          <CardDescription>Traffic and conversion KPIs for the selected filters.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {(payload?.kpis ?? []).map((kpi) => (
              <div className="rounded-md border bg-card p-3" key={kpi.key}>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
                <p className="mt-1 text-lg font-semibold">{formatKpiValue(kpi)}</p>
              </div>
            ))}
          </div>
          {(payload?.kpis ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No KPI data for the selected filters.</p>
          ) : null}
        </CardContent>
      </Card>

      {renderTrafficTable(
        sources,
        "Sources",
        "Top utm_source groups with sessions, purchases, paid conversion, and net revenue.",
        queryString,
        field,
        direction
      )}

      {renderTrafficTable(
        campaigns,
        "Campaigns",
        "Top utm_campaign groups with sessions, purchases, paid conversion, and net revenue.",
        queryString,
        field,
        direction
      )}

      {renderTrafficTable(
        devices,
        "Devices",
        "Device breakdown (available only when marts expose device_type).",
        queryString,
        field,
        direction
      )}

      {renderTrafficTable(
        countries,
        "Countries",
        "Country breakdown (available only when marts expose country and privacy-safe aggregation exists).",
        queryString,
        field,
        direction
      )}

      {renderTrafficTable(
        referrers,
        "Referrers",
        "Top referrers when captured in marts.",
        queryString,
        field,
        direction
      )}
    </AdminAnalyticsPageScaffold>
  );
}

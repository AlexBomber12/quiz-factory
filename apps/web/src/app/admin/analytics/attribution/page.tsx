import { headers } from "next/headers";
import Link from "next/link";

import AdminChart from "@/components/admin/charts/AdminChart";
import { buildStackedBarOption } from "@/components/admin/charts/options";
import AdminAnalyticsPageScaffold from "@/components/admin/analytics/PageScaffold";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  AdminAnalyticsAttributionResponse,
  AdminAnalyticsAttributionRow
} from "@/lib/admin_analytics/types";

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
  "utm_source",
  "content_type",
  "content_key"
] as const;
const QUERY_KEYS = [...FILTER_KEYS, "sort", "dir"] as const;
const SORT_FIELDS = [
  "tenant_id",
  "content_key",
  "offer_key",
  "gross_revenue_eur",
  "net_revenue_eur",
  "refunds_eur",
  "conversion",
  "purchases"
] as const;

type AttributionSortField = (typeof SORT_FIELDS)[number];
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

const fetchAttribution = async (
  resolvedSearchParams: SearchParams
): Promise<{ payload: AdminAnalyticsAttributionResponse | null; error: string | null }> => {
  const queryString = buildQueryString(resolvedSearchParams, FILTER_KEYS);
  const { origin, cookieHeader } = await readOrigin();
  const requestUrl = queryString
    ? `${origin}/api/admin/analytics/attribution?${queryString}`
    : `${origin}/api/admin/analytics/attribution`;

  try {
    const response = await fetch(requestUrl, {
      method: "GET",
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined
    });

    if (!response.ok) {
      return {
        payload: null,
        error: `Attribution request failed with status ${response.status}.`
      };
    }

    return {
      payload: (await response.json()) as AdminAnalyticsAttributionResponse,
      error: null
    };
  } catch (error) {
    return {
      payload: null,
      error: error instanceof Error ? error.message : "Failed to load attribution analytics."
    };
  }
};

const normalizeSortField = (value: string | null): AttributionSortField => {
  if (value && SORT_FIELDS.includes(value as AttributionSortField)) {
    return value as AttributionSortField;
  }

  return "net_revenue_eur";
};

const normalizeSortDirection = (value: string | null): SortDirection => {
  return value === "asc" ? "asc" : "desc";
};

const readSort = (
  resolvedSearchParams: SearchParams
): { field: AttributionSortField; direction: SortDirection } => {
  return {
    field: normalizeSortField(asSingleValue(resolvedSearchParams.sort)),
    direction: normalizeSortDirection(asSingleValue(resolvedSearchParams.dir))
  };
};

const sortRows = (
  rows: AdminAnalyticsAttributionRow[],
  field: AttributionSortField,
  direction: SortDirection
): AdminAnalyticsAttributionRow[] => {
  const sorted = [...rows].sort((left, right) => {
    let comparison = 0;

    switch (field) {
      case "tenant_id":
        comparison = left.tenant_id.localeCompare(right.tenant_id);
        break;
      case "content_key":
        comparison = left.content_key.localeCompare(right.content_key);
        break;
      case "offer_key":
        comparison = left.offer_key.localeCompare(right.offer_key);
        break;
      case "gross_revenue_eur":
        comparison = left.gross_revenue_eur - right.gross_revenue_eur;
        break;
      case "net_revenue_eur":
        comparison = left.net_revenue_eur - right.net_revenue_eur;
        break;
      case "refunds_eur":
        comparison = left.refunds_eur - right.refunds_eur;
        break;
      case "conversion":
        comparison = left.conversion - right.conversion;
        break;
      case "purchases":
        comparison = left.purchases - right.purchases;
        break;
      default:
        comparison = 0;
    }

    if (comparison === 0) {
      return (
        left.tenant_id.localeCompare(right.tenant_id) ||
        left.content_key.localeCompare(right.content_key) ||
        left.offer_key.localeCompare(right.offer_key) ||
        left.pricing_variant.localeCompare(right.pricing_variant)
      );
    }

    return direction === "asc" ? comparison : -comparison;
  });

  return sorted;
};

const buildSortHref = (
  currentQueryString: string,
  currentField: AttributionSortField,
  currentDirection: SortDirection,
  targetField: AttributionSortField
): string => {
  const nextQuery = new URLSearchParams(currentQueryString);
  const nextDirection: SortDirection = currentField === targetField && currentDirection === "desc"
    ? "asc"
    : "desc";
  nextQuery.set("sort", targetField);
  nextQuery.set("dir", nextDirection);

  const queryString = nextQuery.toString();
  return queryString ? `/admin/analytics/attribution?${queryString}` : "/admin/analytics/attribution";
};

const getSortIndicator = (
  currentField: AttributionSortField,
  currentDirection: SortDirection,
  targetField: AttributionSortField
): string => {
  if (currentField !== targetField) {
    return "";
  }

  return currentDirection === "asc" ? " ↑" : " ↓";
};

const buildDrilldownHref = (
  resolvedSearchParams: SearchParams,
  options: {
    tenantId?: string;
    contentKey?: string;
  }
): string => {
  const params = new URLSearchParams(buildQueryString(resolvedSearchParams, FILTER_KEYS));

  if (options.tenantId) {
    params.set("tenant_id", options.tenantId);
  }

  if (options.contentKey) {
    params.set("content_type", "test");
    params.set("content_key", options.contentKey);
  }

  const queryString = params.toString();
  return queryString ? `/admin/analytics/attribution?${queryString}` : "/admin/analytics/attribution";
};

const buildTenantDetailHref = (
  row: AdminAnalyticsAttributionRow,
  resolvedSearchParams: SearchParams
): string => {
  const params = new URLSearchParams(buildQueryString(resolvedSearchParams, FILTER_KEYS));
  params.delete("content_type");
  params.delete("content_key");
  params.set("tenant_id", row.tenant_id);
  params.set("test_id", row.content_key);
  const queryString = params.toString();

  const encodedTenantId = encodeURIComponent(row.tenant_id);
  return queryString
    ? `/admin/analytics/tenants/${encodedTenantId}?${queryString}`
    : `/admin/analytics/tenants/${encodedTenantId}`;
};

const buildTestDetailHref = (
  row: AdminAnalyticsAttributionRow,
  resolvedSearchParams: SearchParams
): string => {
  const params = new URLSearchParams(buildQueryString(resolvedSearchParams, FILTER_KEYS));
  params.delete("content_type");
  params.delete("content_key");
  params.set("test_id", row.content_key);
  const queryString = params.toString();

  const encodedTestId = encodeURIComponent(row.content_key);
  return queryString
    ? `/admin/analytics/tests/${encodedTestId}?${queryString}`
    : `/admin/analytics/tests/${encodedTestId}`;
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

const buildAttributionMixChartOption = (payload: AdminAnalyticsAttributionResponse | null) => {
  const rows = payload?.mix ?? [];

  return buildStackedBarOption({
    categories: rows.map((row) => row.segment),
    series: [
      {
        name: "Gross",
        values: rows.map((row) => row.gross_revenue_eur),
        color: "#0284c7"
      },
      {
        name: "Refunds",
        values: rows.map((row) => row.refunds_eur),
        color: "#f59e0b"
      },
      {
        name: "Disputes + fees",
        values: rows.map((row) => row.disputes_fees_eur + row.payment_fees_eur),
        color: "#dc2626"
      },
      {
        name: "Net",
        values: rows.map((row) => row.net_revenue_eur),
        color: "#0f766e"
      }
    ],
    emptyMessage: "No attribution mix for the selected filters."
  });
};

export default async function AdminAnalyticsAttributionPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const { payload, error } = await fetchAttribution(resolvedSearchParams);
  const sort = readSort(resolvedSearchParams);
  const currentQueryString = buildQueryString(resolvedSearchParams, QUERY_KEYS);
  const rows = sortRows(payload?.rows ?? [], sort.field, sort.direction);

  return (
    <AdminAnalyticsPageScaffold
      description="Revenue attribution drilldown from domain to content to offer/pricing."
      links={[
        { href: "/admin/analytics", label: "Back to analytics overview" },
        { href: "/admin/analytics/revenue", label: "Open revenue analytics" },
        { href: "/admin/analytics/tenants", label: "Open tenants analytics" },
        { href: "/admin/analytics/tests", label: "Open tests analytics" }
      ]}
      title="Revenue attribution"
    >
      {error ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Load error</CardTitle>
            <CardDescription>Unable to fetch attribution data.</CardDescription>
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
          <CardTitle className="text-base">Attribution mix</CardTitle>
          <CardDescription>
            {payload
              ? `Stacked revenue mix grouped by ${payload.grouped_by}. Generated at ${formatUtcDate(payload.generated_at_utc)}.`
              : "No attribution payload loaded."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminChart option={buildAttributionMixChartOption(payload)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Attribution table</CardTitle>
          <CardDescription>
            Click <strong>tenant</strong> or <strong>content</strong> to drill down by query filters.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1260px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 font-semibold">
                    <Link href={buildSortHref(currentQueryString, sort.field, sort.direction, "tenant_id")}>
                      tenant{getSortIndicator(sort.field, sort.direction, "tenant_id")}
                    </Link>
                  </th>
                  <th className="px-2 py-2 font-semibold">
                    <Link href={buildSortHref(currentQueryString, sort.field, sort.direction, "content_key")}>
                      content{getSortIndicator(sort.field, sort.direction, "content_key")}
                    </Link>
                  </th>
                  <th className="px-2 py-2 font-semibold">content_type</th>
                  <th className="px-2 py-2 font-semibold">
                    <Link href={buildSortHref(currentQueryString, sort.field, sort.direction, "offer_key")}>
                      offer{getSortIndicator(sort.field, sort.direction, "offer_key")}
                    </Link>
                  </th>
                  <th className="px-2 py-2 font-semibold">pricing_variant</th>
                  <th className="px-2 py-2 font-semibold">
                    <Link href={buildSortHref(currentQueryString, sort.field, sort.direction, "purchases")}>
                      purchases{getSortIndicator(sort.field, sort.direction, "purchases")}
                    </Link>
                  </th>
                  <th className="px-2 py-2 font-semibold">visits</th>
                  <th className="px-2 py-2 font-semibold">
                    <Link href={buildSortHref(currentQueryString, sort.field, sort.direction, "conversion")}>
                      conversion{getSortIndicator(sort.field, sort.direction, "conversion")}
                    </Link>
                  </th>
                  <th className="px-2 py-2 font-semibold">
                    <Link href={buildSortHref(currentQueryString, sort.field, sort.direction, "gross_revenue_eur")}>
                      gross{getSortIndicator(sort.field, sort.direction, "gross_revenue_eur")}
                    </Link>
                  </th>
                  <th className="px-2 py-2 font-semibold">
                    <Link href={buildSortHref(currentQueryString, sort.field, sort.direction, "refunds_eur")}>
                      refunds{getSortIndicator(sort.field, sort.direction, "refunds_eur")}
                    </Link>
                  </th>
                  <th className="px-2 py-2 font-semibold">disputes</th>
                  <th className="px-2 py-2 font-semibold">fees</th>
                  <th className="px-2 py-2 font-semibold">
                    <Link href={buildSortHref(currentQueryString, sort.field, sort.direction, "net_revenue_eur")}>
                      net{getSortIndicator(sort.field, sort.direction, "net_revenue_eur")}
                    </Link>
                  </th>
                  <th className="px-2 py-2 font-semibold">details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    className="border-b align-top"
                    key={`${row.tenant_id}:${row.content_key}:${row.offer_key}:${row.pricing_variant}:${index}`}
                  >
                    <td className="px-2 py-2">
                      <Link
                        className="underline-offset-2 hover:underline"
                        href={buildDrilldownHref(resolvedSearchParams, { tenantId: row.tenant_id })}
                      >
                        <code>{row.tenant_id}</code>
                      </Link>
                    </td>
                    <td className="px-2 py-2">
                      <Link
                        className="underline-offset-2 hover:underline"
                        href={buildDrilldownHref(resolvedSearchParams, { contentKey: row.content_key })}
                      >
                        <code>{row.content_key}</code>
                      </Link>
                    </td>
                    <td className="px-2 py-2">
                      <code>{row.content_type}</code>
                    </td>
                    <td className="px-2 py-2">
                      <code>{row.offer_key}</code>
                    </td>
                    <td className="px-2 py-2">
                      <code>{row.pricing_variant}</code>
                    </td>
                    <td className="px-2 py-2">{numberFormatter.format(row.purchases)}</td>
                    <td className="px-2 py-2">{numberFormatter.format(row.visits)}</td>
                    <td className="px-2 py-2">{percentFormatter.format(row.conversion)}</td>
                    <td className="px-2 py-2">{currencyFormatter.format(row.gross_revenue_eur)}</td>
                    <td className="px-2 py-2">{currencyFormatter.format(row.refunds_eur)}</td>
                    <td className="px-2 py-2">{currencyFormatter.format(row.disputes_fees_eur)}</td>
                    <td className="px-2 py-2">{currencyFormatter.format(row.payment_fees_eur)}</td>
                    <td className="px-2 py-2">{currencyFormatter.format(row.net_revenue_eur)}</td>
                    <td className="px-2 py-2">
                      <div className="flex flex-col gap-1">
                        <Link
                          className="underline-offset-2 hover:underline"
                          href={buildTenantDetailHref(row, resolvedSearchParams)}
                        >
                          Tenant detail
                        </Link>
                        <Link
                          className="underline-offset-2 hover:underline"
                          href={buildTestDetailHref(row, resolvedSearchParams)}
                        >
                          Test detail
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-2 py-4 text-muted-foreground" colSpan={14}>
                      No attribution rows for the selected filters.
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

import { headers } from "next/headers";
import Link from "next/link";

import AdminAnalyticsPageScaffold from "../../../../../components/admin/analytics/PageScaffold";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../../components/ui/card";
import type {
  AdminAnalyticsTenantDetailResponse,
  KpiCard,
  TimeseriesPoint
} from "../../../../../lib/admin_analytics/types";

type SearchParams = Record<string, string | string[] | undefined>;

type PageProps = {
  params: Promise<{ tenant_id: string }> | { tenant_id: string };
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

const resolveParams = async (
  params: PageProps["params"]
): Promise<{ tenant_id: string }> => {
  return Promise.resolve(params);
};

const resolveSearchParams = async (
  searchParams: PageProps["searchParams"]
): Promise<SearchParams> => {
  if (!searchParams) {
    return {};
  }

  return Promise.resolve(searchParams);
};

const asSingleValue = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
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

const fetchTenantDetail = async (
  tenantId: string,
  resolvedSearchParams: SearchParams
): Promise<{ payload: AdminAnalyticsTenantDetailResponse | null; error: string | null }> => {
  const queryString = buildQueryString(resolvedSearchParams, FILTER_KEYS);
  const encodedTenantId = encodeURIComponent(tenantId);
  const { origin, cookieHeader } = await readOrigin();
  const requestUrl = queryString
    ? `${origin}/api/admin/analytics/tenants/${encodedTenantId}?${queryString}`
    : `${origin}/api/admin/analytics/tenants/${encodedTenantId}`;

  try {
    const response = await fetch(requestUrl, {
      method: "GET",
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined
    });

    if (!response.ok) {
      return {
        payload: null,
        error: `Tenant detail request failed with status ${response.status}.`
      };
    }

    return {
      payload: (await response.json()) as AdminAnalyticsTenantDetailResponse,
      error: null
    };
  } catch (error) {
    return {
      payload: null,
      error: error instanceof Error ? error.message : "Failed to load tenant analytics detail."
    };
  }
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

const formatPercent = (value: number | null): string => {
  if (value === null) {
    return "N/A";
  }

  return percentFormatter.format(value);
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

const buildTimeseriesRows = (
  sessionsTimeseries: TimeseriesPoint[],
  revenueTimeseries: TimeseriesPoint[]
): Array<{ date: string; sessions: number; net_revenue_eur: number }> => {
  const byDate = new Map<string, { sessions: number; net_revenue_eur: number }>();

  for (const point of sessionsTimeseries) {
    byDate.set(point.date, {
      sessions: point.value,
      net_revenue_eur: byDate.get(point.date)?.net_revenue_eur ?? 0
    });
  }

  for (const point of revenueTimeseries) {
    const existing = byDate.get(point.date);
    byDate.set(point.date, {
      sessions: existing?.sessions ?? 0,
      net_revenue_eur: point.value
    });
  }

  return [...byDate.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([date, row]) => ({
      date,
      sessions: row.sessions,
      net_revenue_eur: row.net_revenue_eur
    }));
};

export default async function AdminAnalyticsTenantDetailPage({ params, searchParams }: PageProps) {
  const resolvedParams = await resolveParams(params);
  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const encodedTenantId = encodeURIComponent(resolvedParams.tenant_id);
  const filterQueryString = buildQueryString(resolvedSearchParams, FILTER_KEYS);
  const { payload, error } = await fetchTenantDetail(resolvedParams.tenant_id, resolvedSearchParams);
  const timeseriesRows = buildTimeseriesRows(
    payload?.sessions_timeseries ?? [],
    payload?.revenue_timeseries ?? []
  );

  return (
    <AdminAnalyticsPageScaffold
      description="Single-tenant analytics detail from mart_funnel_daily and mart_pnl_daily."
      links={[
        { href: "/admin/analytics/tenants", label: "Back to tenants analytics" },
        {
          href: `/admin/analytics/distribution?tenant_id=${encodedTenantId}`,
          label: "Open distribution filtered by this tenant"
        },
        {
          href: `/admin/analytics/traffic?tenant_id=${encodedTenantId}`,
          label: "Open traffic filtered by this tenant"
        }
      ]}
      title="Tenant analytics detail"
    >
      {error ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Load error</CardTitle>
            <CardDescription>Unable to fetch tenant detail.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {payload && !payload.has_data ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No data</CardTitle>
            <CardDescription>
              No analytics rows found for <code>{payload.tenant_id}</code> in the selected range.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              className="text-primary underline underline-offset-4 hover:no-underline"
              href={filterQueryString ? `/admin/analytics/tenants?${filterQueryString}` : "/admin/analytics/tenants"}
            >
              Back to tenants list
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">KPI cards</CardTitle>
          <CardDescription>
            {payload
              ? `Generated at ${formatUtcDate(payload.generated_at_utc)} for tenant ${payload.tenant_id}.`
              : "No tenant detail payload loaded."}
          </CardDescription>
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
            <p className="text-sm text-muted-foreground">No KPI data for this tenant.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Funnel</CardTitle>
          <CardDescription>Counts and conversion rates for this tenant.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 font-semibold">step</th>
                  <th className="px-2 py-2 font-semibold">count</th>
                  <th className="px-2 py-2 font-semibold">conversion_rate</th>
                </tr>
              </thead>
              <tbody>
                {(payload?.funnel ?? []).map((step) => (
                  <tr className="border-b align-top" key={step.key}>
                    <td className="px-2 py-2">{step.label}</td>
                    <td className="px-2 py-2">{numberFormatter.format(step.count)}</td>
                    <td className="px-2 py-2">{formatPercent(step.conversion_rate)}</td>
                  </tr>
                ))}
                {(payload?.funnel ?? []).length === 0 ? (
                  <tr>
                    <td className="px-2 py-4 text-muted-foreground" colSpan={3}>
                      No funnel data for this tenant.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily sessions and net revenue</CardTitle>
          <CardDescription>Daily series points in the selected date range.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 font-semibold">date</th>
                  <th className="px-2 py-2 font-semibold">sessions</th>
                  <th className="px-2 py-2 font-semibold">net_revenue_eur</th>
                </tr>
              </thead>
              <tbody>
                {timeseriesRows.map((row) => (
                  <tr className="border-b align-top" key={row.date}>
                    <td className="px-2 py-2">{row.date}</td>
                    <td className="px-2 py-2">{numberFormatter.format(row.sessions)}</td>
                    <td className="px-2 py-2">{currencyFormatter.format(row.net_revenue_eur)}</td>
                  </tr>
                ))}
                {timeseriesRows.length === 0 ? (
                  <tr>
                    <td className="px-2 py-4 text-muted-foreground" colSpan={3}>
                      No daily series data for this tenant.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top tests</CardTitle>
          <CardDescription>
            {payload ? `Showing ${payload.top_tests.length} of ${payload.top_tests_total} tests.` : "No test rows."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 font-semibold">test_id</th>
                  <th className="px-2 py-2 font-semibold">sessions</th>
                  <th className="px-2 py-2 font-semibold">starts</th>
                  <th className="px-2 py-2 font-semibold">completes</th>
                  <th className="px-2 py-2 font-semibold">purchases</th>
                  <th className="px-2 py-2 font-semibold">paid conversion</th>
                  <th className="px-2 py-2 font-semibold">net revenue</th>
                  <th className="px-2 py-2 font-semibold">refunds</th>
                </tr>
              </thead>
              <tbody>
                {(payload?.top_tests ?? []).map((row) => (
                  <tr className="border-b align-top" key={row.test_id}>
                    <td className="px-2 py-2">
                      <code>{row.test_id}</code>
                    </td>
                    <td className="px-2 py-2">{numberFormatter.format(Number(row.sessions))}</td>
                    <td className="px-2 py-2">{numberFormatter.format(Number(row.test_starts))}</td>
                    <td className="px-2 py-2">{numberFormatter.format(Number(row.test_completions))}</td>
                    <td className="px-2 py-2">{numberFormatter.format(Number(row.purchases))}</td>
                    <td className="px-2 py-2">{percentFormatter.format(Number(row.paid_conversion))}</td>
                    <td className="px-2 py-2">{currencyFormatter.format(Number(row.net_revenue_eur))}</td>
                    <td className="px-2 py-2">{currencyFormatter.format(Number(row.refunds_eur))}</td>
                  </tr>
                ))}
                {(payload?.top_tests ?? []).length === 0 ? (
                  <tr>
                    <td className="px-2 py-4 text-muted-foreground" colSpan={8}>
                      No top tests for this tenant.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Locale breakdown</CardTitle>
          <CardDescription>
            {payload
              ? `Showing ${payload.locale_breakdown.length} of ${payload.locale_breakdown_total} locale rows.`
              : "No locale rows."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 font-semibold">locale</th>
                  <th className="px-2 py-2 font-semibold">sessions</th>
                  <th className="px-2 py-2 font-semibold">starts</th>
                  <th className="px-2 py-2 font-semibold">completes</th>
                  <th className="px-2 py-2 font-semibold">purchases</th>
                  <th className="px-2 py-2 font-semibold">paid conversion</th>
                  <th className="px-2 py-2 font-semibold">net revenue</th>
                  <th className="px-2 py-2 font-semibold">refunds</th>
                </tr>
              </thead>
              <tbody>
                {(payload?.locale_breakdown ?? []).map((row) => (
                  <tr className="border-b align-top" key={row.locale}>
                    <td className="px-2 py-2">{row.locale}</td>
                    <td className="px-2 py-2">{numberFormatter.format(Number(row.sessions))}</td>
                    <td className="px-2 py-2">{numberFormatter.format(Number(row.test_starts))}</td>
                    <td className="px-2 py-2">{numberFormatter.format(Number(row.test_completions))}</td>
                    <td className="px-2 py-2">{numberFormatter.format(Number(row.purchases))}</td>
                    <td className="px-2 py-2">{percentFormatter.format(Number(row.paid_conversion))}</td>
                    <td className="px-2 py-2">{currencyFormatter.format(Number(row.net_revenue_eur))}</td>
                    <td className="px-2 py-2">{currencyFormatter.format(Number(row.refunds_eur))}</td>
                  </tr>
                ))}
                {(payload?.locale_breakdown ?? []).length === 0 ? (
                  <tr>
                    <td className="px-2 py-4 text-muted-foreground" colSpan={8}>
                      No locale breakdown rows for this tenant.
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

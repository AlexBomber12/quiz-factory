import { headers } from "next/headers";
import Link from "next/link";

import AdminAnalyticsPageScaffold from "../../../../../components/admin/analytics/PageScaffold";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../../components/ui/card";
import type {
  AdminAnalyticsTestDetailResponse,
  AdminAnalyticsTestTimeseriesRow,
  KpiCard
} from "../../../../../lib/admin_analytics/types";

type SearchParams = Record<string, string | string[] | undefined>;

type PageProps = {
  params: Promise<{ test_id: string }> | { test_id: string };
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
const TAB_VALUES = ["tenant", "locale", "paywall"] as const;

type BreakdownTab = (typeof TAB_VALUES)[number];

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
): Promise<{ test_id: string }> => {
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

const normalizeTab = (value: string | null): BreakdownTab => {
  if (value && TAB_VALUES.includes(value as BreakdownTab)) {
    return value as BreakdownTab;
  }

  return "tenant";
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

const fetchTestDetail = async (
  testId: string,
  resolvedSearchParams: SearchParams
): Promise<{ payload: AdminAnalyticsTestDetailResponse | null; error: string | null }> => {
  const queryString = buildQueryString(resolvedSearchParams, FILTER_KEYS);
  const encodedTestId = encodeURIComponent(testId);
  const { origin, cookieHeader } = await readOrigin();
  const requestUrl = queryString
    ? `${origin}/api/admin/analytics/tests/${encodedTestId}?${queryString}`
    : `${origin}/api/admin/analytics/tests/${encodedTestId}`;

  try {
    const response = await fetch(requestUrl, {
      method: "GET",
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined
    });

    if (!response.ok) {
      return {
        payload: null,
        error: `Test detail request failed with status ${response.status}.`
      };
    }

    return {
      payload: (await response.json()) as AdminAnalyticsTestDetailResponse,
      error: null
    };
  } catch (error) {
    return {
      payload: null,
      error: error instanceof Error ? error.message : "Failed to load test analytics detail."
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

const maxValue = (rows: AdminAnalyticsTestTimeseriesRow[], selector: (row: AdminAnalyticsTestTimeseriesRow) => number): number => {
  return rows.reduce((max, row) => {
    const value = selector(row);
    return value > max ? value : max;
  }, 0);
};

const toBarWidth = (value: number, max: number): string => {
  if (max <= 0 || value <= 0) {
    return "0%";
  }

  const width = Math.max(4, Math.round((value / max) * 100));
  return `${Math.min(width, 100)}%`;
};

export default async function AdminAnalyticsTestDetailPage({ params, searchParams }: PageProps) {
  const resolvedParams = await resolveParams(params);
  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const selectedTab = normalizeTab(asSingleValue(resolvedSearchParams.tab));
  const encodedTestId = encodeURIComponent(resolvedParams.test_id);
  const filterQueryString = buildQueryString(resolvedSearchParams, FILTER_KEYS);
  const { payload, error } = await fetchTestDetail(resolvedParams.test_id, resolvedSearchParams);
  const rows = payload?.timeseries ?? [];
  const maxSessions = maxValue(rows, (row) => row.sessions);
  const maxCompletes = maxValue(rows, (row) => row.completes);
  const maxPurchases = maxValue(rows, (row) => row.purchases);
  const maxRevenue = maxValue(rows, (row) => row.net_revenue_eur);

  const buildTabHref = (tab: BreakdownTab): string => {
    const query = new URLSearchParams(filterQueryString);
    query.set("tab", tab);
    const queryString = query.toString();
    return queryString
      ? `/admin/analytics/tests/${encodedTestId}?${queryString}`
      : `/admin/analytics/tests/${encodedTestId}`;
  };

  return (
    <AdminAnalyticsPageScaffold
      description="Single-test analytics detail from mart_funnel_daily and mart_pnl_daily."
      links={[
        { href: "/admin/analytics/tests", label: "Back to tests analytics" },
        {
          href: `/admin/analytics/distribution?test_id=${encodedTestId}`,
          label: "Open distribution filtered by this test"
        },
        {
          href: `/admin/analytics/revenue?test_id=${encodedTestId}`,
          label: "Open revenue filtered by this test"
        }
      ]}
      title="Test analytics detail"
    >
      {error ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Load error</CardTitle>
            <CardDescription>Unable to fetch test detail.</CardDescription>
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
          <CardTitle className="text-base">KPI cards</CardTitle>
          <CardDescription>
            {payload
              ? `Generated at ${formatUtcDate(payload.generated_at_utc)} for test ${payload.test_id}.`
              : "No test detail payload loaded."}
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
            <p className="text-sm text-muted-foreground">No KPI data for this test.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Funnel</CardTitle>
          <CardDescription>Counts and conversion rates for this test.</CardDescription>
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
                      No funnel data for this test.
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
          <CardTitle className="text-base">Daily trends (chart)</CardTitle>
          <CardDescription>Sessions, completes, purchases, and net revenue by day.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 font-semibold">date</th>
                  <th className="px-2 py-2 font-semibold">sessions</th>
                  <th className="px-2 py-2 font-semibold">completes</th>
                  <th className="px-2 py-2 font-semibold">purchases</th>
                  <th className="px-2 py-2 font-semibold">net_revenue_eur</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr className="border-b align-top" key={row.date}>
                    <td className="px-2 py-2">{row.date}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <span className="min-w-14">{numberFormatter.format(row.sessions)}</span>
                        <div className="h-2 w-full rounded bg-muted">
                          <div className="h-2 rounded bg-blue-500" style={{ width: toBarWidth(row.sessions, maxSessions) }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <span className="min-w-14">{numberFormatter.format(row.completes)}</span>
                        <div className="h-2 w-full rounded bg-muted">
                          <div className="h-2 rounded bg-emerald-500" style={{ width: toBarWidth(row.completes, maxCompletes) }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <span className="min-w-14">{numberFormatter.format(row.purchases)}</span>
                        <div className="h-2 w-full rounded bg-muted">
                          <div className="h-2 rounded bg-amber-500" style={{ width: toBarWidth(row.purchases, maxPurchases) }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <span className="min-w-20">{currencyFormatter.format(row.net_revenue_eur)}</span>
                        <div className="h-2 w-full rounded bg-muted">
                          <div className="h-2 rounded bg-violet-500" style={{ width: toBarWidth(row.net_revenue_eur, maxRevenue) }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-2 py-4 text-muted-foreground" colSpan={5}>
                      No daily trend rows for this test.
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
          <CardTitle className="text-base">Breakdown tabs</CardTitle>
          <CardDescription>Switch between tenant, locale, and paywall detail views.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {TAB_VALUES.map((tab) => (
              <Link
                className={
                  tab === selectedTab
                    ? "rounded-md border bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                    : "rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
                }
                href={buildTabHref(tab)}
                key={tab}
              >
                {tab}
              </Link>
            ))}
          </div>

          {selectedTab === "tenant" ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-2 py-2 font-semibold">tenant_id</th>
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
                  {(payload?.tenant_breakdown ?? []).map((row) => (
                    <tr className="border-b align-top" key={row.tenant_id}>
                      <td className="px-2 py-2"><code>{row.tenant_id}</code></td>
                      <td className="px-2 py-2">{numberFormatter.format(Number(row.sessions))}</td>
                      <td className="px-2 py-2">{numberFormatter.format(Number(row.starts))}</td>
                      <td className="px-2 py-2">{numberFormatter.format(Number(row.completes))}</td>
                      <td className="px-2 py-2">{numberFormatter.format(Number(row.purchases))}</td>
                      <td className="px-2 py-2">{percentFormatter.format(Number(row.paid_conversion))}</td>
                      <td className="px-2 py-2">{currencyFormatter.format(Number(row.net_revenue_eur))}</td>
                      <td className="px-2 py-2">{currencyFormatter.format(Number(row.refunds_eur))}</td>
                    </tr>
                  ))}
                  {(payload?.tenant_breakdown ?? []).length === 0 ? (
                    <tr>
                      <td className="px-2 py-4 text-muted-foreground" colSpan={8}>
                        No tenant rows for this test.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}

          {selectedTab === "locale" ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left text-sm">
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
                      <td className="px-2 py-2">{numberFormatter.format(Number(row.starts))}</td>
                      <td className="px-2 py-2">{numberFormatter.format(Number(row.completes))}</td>
                      <td className="px-2 py-2">{numberFormatter.format(Number(row.purchases))}</td>
                      <td className="px-2 py-2">{percentFormatter.format(Number(row.paid_conversion))}</td>
                      <td className="px-2 py-2">{currencyFormatter.format(Number(row.net_revenue_eur))}</td>
                      <td className="px-2 py-2">{currencyFormatter.format(Number(row.refunds_eur))}</td>
                    </tr>
                  ))}
                  {(payload?.locale_breakdown ?? []).length === 0 ? (
                    <tr>
                      <td className="px-2 py-4 text-muted-foreground" colSpan={8}>
                        No locale rows for this test.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}

          {selectedTab === "paywall" ? (
            <div className="overflow-x-auto">
              {payload?.paywall_metrics_available && payload.paywall_metrics ? (
                <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-2 py-2 font-semibold">views</th>
                      <th className="px-2 py-2 font-semibold">checkout_starts</th>
                      <th className="px-2 py-2 font-semibold">checkout_success</th>
                      <th className="px-2 py-2 font-semibold">checkout start rate</th>
                      <th className="px-2 py-2 font-semibold">checkout success rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b align-top">
                      <td className="px-2 py-2">{numberFormatter.format(payload.paywall_metrics.views)}</td>
                      <td className="px-2 py-2">{numberFormatter.format(payload.paywall_metrics.checkout_starts)}</td>
                      <td className="px-2 py-2">{numberFormatter.format(payload.paywall_metrics.checkout_success)}</td>
                      <td className="px-2 py-2">{percentFormatter.format(payload.paywall_metrics.checkout_start_rate)}</td>
                      <td className="px-2 py-2">{percentFormatter.format(payload.paywall_metrics.checkout_success_rate)}</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-muted-foreground">Paywall metrics are not available in marts for this test.</p>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Link
            className="text-primary underline underline-offset-4 hover:no-underline"
            href={filterQueryString ? `/admin/analytics/tests?${filterQueryString}` : "/admin/analytics/tests"}
          >
            Back to tests list
          </Link>
        </CardContent>
      </Card>
    </AdminAnalyticsPageScaffold>
  );
}

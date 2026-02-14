import { headers } from "next/headers";

import AdminAnalyticsPageScaffold from "../../../components/admin/analytics/PageScaffold";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "../../../components/ui/card";
import type {
  AdminAnalyticsOverviewAlertRow,
  AdminAnalyticsOverviewFreshnessRow,
  AdminAnalyticsOverviewResponse,
  KpiCard
} from "../../../lib/admin_analytics/types";

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

const buildFilterQueryString = async (searchParams: PageProps["searchParams"]): Promise<string> => {
  if (!searchParams) {
    return "";
  }

  const resolved = await Promise.resolve(searchParams);
  const params = new URLSearchParams();

  for (const key of FILTER_KEYS) {
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

const fetchOverview = async (
  searchParams: PageProps["searchParams"]
): Promise<{ payload: AdminAnalyticsOverviewResponse | null; error: string | null }> => {
  const queryString = await buildFilterQueryString(searchParams);
  const { origin, cookieHeader } = await readOrigin();
  const requestUrl = queryString
    ? `${origin}/api/admin/analytics/overview?${queryString}`
    : `${origin}/api/admin/analytics/overview`;

  try {
    const response = await fetch(requestUrl, {
      method: "GET",
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined
    });
    if (!response.ok) {
      return {
        payload: null,
        error: `Overview request failed with status ${response.status}.`
      };
    }

    return {
      payload: (await response.json()) as AdminAnalyticsOverviewResponse,
      error: null
    };
  } catch (error) {
    return {
      payload: null,
      error: error instanceof Error ? error.message : "Failed to load analytics overview."
    };
  }
};

const renderAlerts = (alerts: AdminAnalyticsOverviewAlertRow[]) => {
  if (alerts.length === 0) {
    return <p className="text-sm text-muted-foreground">No alerts in the selected date range.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="px-2 py-2 font-semibold">detected_at_utc</th>
            <th className="px-2 py-2 font-semibold">alert_name</th>
            <th className="px-2 py-2 font-semibold">severity</th>
            <th className="px-2 py-2 font-semibold">tenant_id</th>
            <th className="px-2 py-2 font-semibold">metric_value</th>
            <th className="px-2 py-2 font-semibold">threshold_value</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((row, index) => (
            <tr className="border-b align-top" key={`${row.alert_name}:${row.detected_at_utc}:${index}`}>
              <td className="px-2 py-2">{formatUtcDate(row.detected_at_utc)}</td>
              <td className="px-2 py-2">{row.alert_name}</td>
              <td className="px-2 py-2">{row.severity}</td>
              <td className="px-2 py-2">{row.tenant_id ?? "all"}</td>
              <td className="px-2 py-2">
                {row.metric_value === null ? "N/A" : numberFormatter.format(row.metric_value)}
              </td>
              <td className="px-2 py-2">
                {row.threshold_value === null ? "N/A" : numberFormatter.format(row.threshold_value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const renderFreshness = (rows: AdminAnalyticsOverviewFreshnessRow[]) => {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No freshness data available.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="px-2 py-2 font-semibold">table</th>
            <th className="px-2 py-2 font-semibold">max_date</th>
            <th className="px-2 py-2 font-semibold">available</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-b align-top" key={row.table}>
              <td className="px-2 py-2">{row.table}</td>
              <td className="px-2 py-2">{row.max_date ?? "N/A"}</td>
              <td className="px-2 py-2">{row.available ? "yes" : "no"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default async function AdminAnalyticsOverviewPage({ searchParams }: PageProps) {
  const { payload, error } = await fetchOverview(searchParams);

  return (
    <AdminAnalyticsPageScaffold
      description="Global analytics overview powered by the admin analytics API."
      links={[
        { href: "/admin/analytics/tests", label: "Open tests analytics" },
        { href: "/admin/analytics/tenants", label: "Open tenants analytics" },
        { href: "/admin/analytics/distribution", label: "Open distribution matrix" },
        { href: "/admin/analytics/traffic", label: "Open traffic analytics" },
        { href: "/admin/analytics/revenue", label: "Open revenue analytics" },
        { href: "/admin/analytics/data", label: "Open data health" }
      ]}
      title="Analytics overview"
    >
      {error ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Load error</CardTitle>
            <CardDescription>Unable to fetch overview data.</CardDescription>
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
            {payload ? `Generated at ${formatUtcDate(payload.generated_at_utc)}` : "No analytics payload loaded."}
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
            <p className="text-sm text-muted-foreground">No KPI data for the selected filters.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Funnel</CardTitle>
          <CardDescription>Counts and conversion rates from mart_funnel_daily.</CardDescription>
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
                      No funnel data for the selected filters.
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
          <CardDescription>Sorted by net revenue and paid conversion.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 font-semibold">test_id</th>
                  <th className="px-2 py-2 font-semibold">net_revenue_eur</th>
                  <th className="px-2 py-2 font-semibold">purchase_conversion</th>
                  <th className="px-2 py-2 font-semibold">purchases</th>
                </tr>
              </thead>
              <tbody>
                {(payload?.top_tests ?? []).map((row) => (
                  <tr className="border-b align-top" key={row.test_id}>
                    <td className="px-2 py-2">
                      <code>{row.test_id}</code>
                    </td>
                    <td className="px-2 py-2">{currencyFormatter.format(row.net_revenue_eur)}</td>
                    <td className="px-2 py-2">{percentFormatter.format(row.purchase_conversion)}</td>
                    <td className="px-2 py-2">{numberFormatter.format(row.purchases)}</td>
                  </tr>
                ))}
                {(payload?.top_tests ?? []).length === 0 ? (
                  <tr>
                    <td className="px-2 py-4 text-muted-foreground" colSpan={4}>
                      No test rows for the selected filters.
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
          <CardTitle className="text-base">Top tenants</CardTitle>
          <CardDescription>Sorted by net revenue.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 font-semibold">tenant_id</th>
                  <th className="px-2 py-2 font-semibold">net_revenue_eur</th>
                  <th className="px-2 py-2 font-semibold">purchases</th>
                </tr>
              </thead>
              <tbody>
                {(payload?.top_tenants ?? []).map((row) => (
                  <tr className="border-b align-top" key={row.tenant_id}>
                    <td className="px-2 py-2">
                      <code>{row.tenant_id}</code>
                    </td>
                    <td className="px-2 py-2">{currencyFormatter.format(row.net_revenue_eur)}</td>
                    <td className="px-2 py-2">{numberFormatter.format(row.purchases)}</td>
                  </tr>
                ))}
                {(payload?.top_tenants ?? []).length === 0 ? (
                  <tr>
                    <td className="px-2 py-4 text-muted-foreground" colSpan={3}>
                      No tenant rows for the selected filters.
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
          <CardTitle className="text-base">Data freshness</CardTitle>
          <CardDescription>Latest available partition dates from marts tables.</CardDescription>
        </CardHeader>
        <CardContent>{renderFreshness(payload?.data_freshness ?? [])}</CardContent>
      </Card>

      {payload?.alerts_available ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alerts</CardTitle>
            <CardDescription>Recent anomaly checks from marts.alert_events.</CardDescription>
          </CardHeader>
          <CardContent>{renderAlerts(payload.alerts)}</CardContent>
        </Card>
      ) : null}
    </AdminAnalyticsPageScaffold>
  );
}

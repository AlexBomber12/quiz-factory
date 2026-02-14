import { headers } from "next/headers";

import AdminAnalyticsPageScaffold from "../../../../components/admin/analytics/PageScaffold";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import type {
  AdminAnalyticsRevenueByOfferRow,
  AdminAnalyticsRevenueByTenantRow,
  AdminAnalyticsRevenueByTestRow,
  AdminAnalyticsRevenueResponse,
  KpiCard
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

const fetchRevenue = async (
  resolvedSearchParams: SearchParams
): Promise<{ payload: AdminAnalyticsRevenueResponse | null; error: string | null }> => {
  const queryString = buildQueryString(resolvedSearchParams, FILTER_KEYS);
  const { origin, cookieHeader } = await readOrigin();
  const requestUrl = queryString
    ? `${origin}/api/admin/analytics/revenue?${queryString}`
    : `${origin}/api/admin/analytics/revenue`;

  try {
    const response = await fetch(requestUrl, {
      method: "GET",
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined
    });

    if (!response.ok) {
      return {
        payload: null,
        error: `Revenue request failed with status ${response.status}.`
      };
    }

    return {
      payload: (await response.json()) as AdminAnalyticsRevenueResponse,
      error: null
    };
  } catch (error) {
    return {
      payload: null,
      error: error instanceof Error ? error.message : "Failed to load revenue analytics."
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

  return parsed.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short"
  });
};

const formatKpiValue = (kpi: KpiCard): string => {
  switch (kpi.unit) {
    case "count":
      return numberFormatter.format(kpi.value);
    case "currency_eur":
      return currencyFormatter.format(kpi.value);
    case "ratio":
    case "percent":
      return percentFormatter.format(kpi.value);
    default:
      return String(kpi.value);
  }
};

const renderOfferRows = (rows: AdminAnalyticsRevenueByOfferRow[]) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[840px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="px-2 py-2 font-semibold">offer_type</th>
            <th className="px-2 py-2 font-semibold">offer_key</th>
            <th className="px-2 py-2 font-semibold">pricing_variant</th>
            <th className="px-2 py-2 font-semibold">purchases</th>
            <th className="px-2 py-2 font-semibold">gross</th>
            <th className="px-2 py-2 font-semibold">refunds</th>
            <th className="px-2 py-2 font-semibold">disputes</th>
            <th className="px-2 py-2 font-semibold">fees</th>
            <th className="px-2 py-2 font-semibold">net</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-b align-top" key={`${row.offer_type}:${row.pricing_variant}`}>
              <td className="px-2 py-2">
                <code>{row.offer_type}</code>
              </td>
              <td className="px-2 py-2">
                <code>{row.offer_key}</code>
              </td>
              <td className="px-2 py-2">{row.pricing_variant}</td>
              <td className="px-2 py-2">{numberFormatter.format(row.purchases)}</td>
              <td className="px-2 py-2">{currencyFormatter.format(row.gross_revenue_eur)}</td>
              <td className="px-2 py-2">{currencyFormatter.format(row.refunds_eur)}</td>
              <td className="px-2 py-2">{currencyFormatter.format(row.disputes_fees_eur)}</td>
              <td className="px-2 py-2">{currencyFormatter.format(row.payment_fees_eur)}</td>
              <td className="px-2 py-2">{currencyFormatter.format(row.net_revenue_eur)}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td className="px-2 py-4 text-muted-foreground" colSpan={9}>
                No offer/pricing breakdown for the selected filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
};

const renderEntityRows = (
  rows: AdminAnalyticsRevenueByTenantRow[] | AdminAnalyticsRevenueByTestRow[],
  keyLabel: "tenant_id" | "test_id"
) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="px-2 py-2 font-semibold">{keyLabel}</th>
            <th className="px-2 py-2 font-semibold">purchases</th>
            <th className="px-2 py-2 font-semibold">gross</th>
            <th className="px-2 py-2 font-semibold">refunds</th>
            <th className="px-2 py-2 font-semibold">disputes</th>
            <th className="px-2 py-2 font-semibold">fees</th>
            <th className="px-2 py-2 font-semibold">net</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const idValue = row[keyLabel] as string;
            return (
              <tr className="border-b align-top" key={idValue}>
                <td className="px-2 py-2">
                  <code>{idValue}</code>
                </td>
                <td className="px-2 py-2">{numberFormatter.format(row.purchases)}</td>
                <td className="px-2 py-2">{currencyFormatter.format(row.gross_revenue_eur)}</td>
                <td className="px-2 py-2">{currencyFormatter.format(row.refunds_eur)}</td>
                <td className="px-2 py-2">{currencyFormatter.format(row.disputes_fees_eur)}</td>
                <td className="px-2 py-2">{currencyFormatter.format(row.payment_fees_eur)}</td>
                <td className="px-2 py-2">{currencyFormatter.format(row.net_revenue_eur)}</td>
              </tr>
            );
          })}
          {rows.length === 0 ? (
            <tr>
              <td className="px-2 py-4 text-muted-foreground" colSpan={7}>
                No rows for the selected filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
};

export default async function AdminAnalyticsRevenuePage({ searchParams }: PageProps) {
  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const { payload, error } = await fetchRevenue(resolvedSearchParams);

  return (
    <AdminAnalyticsPageScaffold
      description="Revenue KPIs, offer/pricing mix, and Stripe reconciliation signals."
      links={[
        { href: "/admin/analytics/data", label: "Open data health" },
        { href: "/admin/analytics", label: "Back to analytics overview" }
      ]}
      title="Revenue analytics"
    >
      {error ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Load error</CardTitle>
            <CardDescription>Unable to fetch revenue data.</CardDescription>
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
            {payload ? `Generated at ${formatUtcDate(payload.generated_at_utc)}` : "No revenue payload loaded."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
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
          <CardTitle className="text-base">Reconciliation signals</CardTitle>
          <CardDescription>Stripe vs internal purchase_success checks.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {payload?.reconciliation ? (
            <>
              <p className="text-sm">{payload.reconciliation.detail ?? "No reconciliation detail available."}</p>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-md border bg-card p-3 text-sm">
                  <p className="text-muted-foreground">Stripe purchases</p>
                  <p className="font-semibold">
                    {payload.reconciliation.stripe_purchase_count === null
                      ? "N/A"
                      : numberFormatter.format(payload.reconciliation.stripe_purchase_count)}
                  </p>
                </div>
                <div className="rounded-md border bg-card p-3 text-sm">
                  <p className="text-muted-foreground">Internal purchases</p>
                  <p className="font-semibold">
                    {payload.reconciliation.internal_purchase_count === null
                      ? "N/A"
                      : numberFormatter.format(payload.reconciliation.internal_purchase_count)}
                  </p>
                </div>
                <div className="rounded-md border bg-card p-3 text-sm">
                  <p className="text-muted-foreground">Purchase diff %</p>
                  <p className="font-semibold">
                    {payload.reconciliation.purchase_count_diff_pct === null
                      ? "N/A"
                      : percentFormatter.format(payload.reconciliation.purchase_count_diff_pct)}
                  </p>
                </div>
                <div className="rounded-md border bg-card p-3 text-sm">
                  <p className="text-muted-foreground">Gross diff %</p>
                  <p className="font-semibold">
                    {payload.reconciliation.gross_revenue_diff_pct === null
                      ? "N/A"
                      : percentFormatter.format(payload.reconciliation.gross_revenue_diff_pct)}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No reconciliation payload.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">By offer and pricing variant</CardTitle>
          <CardDescription>Offer-level purchase and revenue composition.</CardDescription>
        </CardHeader>
        <CardContent>{renderOfferRows(payload?.by_offer ?? [])}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top tenants</CardTitle>
          <CardDescription>Revenue contribution by tenant_id.</CardDescription>
        </CardHeader>
        <CardContent>{renderEntityRows(payload?.by_tenant ?? [], "tenant_id")}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top tests</CardTitle>
          <CardDescription>Revenue contribution by test_id.</CardDescription>
        </CardHeader>
        <CardContent>{renderEntityRows(payload?.by_test ?? [], "test_id")}</CardContent>
      </Card>
    </AdminAnalyticsPageScaffold>
  );
}

import { headers } from "next/headers";

import AdminAnalyticsPageScaffold from "../../../../components/admin/analytics/PageScaffold";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import type {
  AdminAnalyticsDataAlertRow,
  AdminAnalyticsDataFreshnessRow,
  AdminAnalyticsDataHealthCheck,
  AdminAnalyticsDataHealthStatus,
  AdminAnalyticsDataResponse
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

const fetchDataHealth = async (
  resolvedSearchParams: SearchParams
): Promise<{ payload: AdminAnalyticsDataResponse | null; error: string | null }> => {
  const queryString = buildQueryString(resolvedSearchParams, FILTER_KEYS);
  const { origin, cookieHeader } = await readOrigin();
  const requestUrl = queryString
    ? `${origin}/api/admin/analytics/data?${queryString}`
    : `${origin}/api/admin/analytics/data`;

  try {
    const response = await fetch(requestUrl, {
      method: "GET",
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined
    });

    if (!response.ok) {
      return {
        payload: null,
        error: `Data health request failed with status ${response.status}.`
      };
    }

    return {
      payload: (await response.json()) as AdminAnalyticsDataResponse,
      error: null
    };
  } catch (error) {
    return {
      payload: null,
      error: error instanceof Error ? error.message : "Failed to load data health analytics."
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

const healthStatusLabel = (status: AdminAnalyticsDataHealthStatus): string => {
  switch (status) {
    case "ok":
      return "OK";
    case "warn":
      return "Warning";
    case "error":
      return "Error";
    default:
      return status;
  }
};

const statusClassName = (status: AdminAnalyticsDataHealthStatus): string => {
  switch (status) {
    case "ok":
      return "text-emerald-700";
    case "warn":
      return "text-amber-700";
    case "error":
      return "text-red-700";
    default:
      return "text-muted-foreground";
  }
};

const renderFreshnessCards = (rows: AdminAnalyticsDataFreshnessRow[]) => {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => (
        <div className="rounded-md border bg-card p-3" key={`${row.dataset}.${row.table}`}>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {row.dataset}.{row.table}
          </p>
          <p className={`mt-1 text-sm font-semibold ${statusClassName(row.status)}`}>
            {healthStatusLabel(row.status)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Last loaded: {formatUtcDate(row.last_loaded_utc)}
          </p>
          <p className="text-xs text-muted-foreground">
            Lag: {row.lag_minutes === null ? "N/A" : `${numberFormatter.format(row.lag_minutes)} min`}
          </p>
          <p className="text-xs text-muted-foreground">
            Thresholds: warn {numberFormatter.format(row.warn_after_minutes)} min, error {numberFormatter.format(row.error_after_minutes)} min
          </p>
        </div>
      ))}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No freshness rows available.</p>
      ) : null}
    </div>
  );
};

const renderChecks = (checks: AdminAnalyticsDataHealthCheck[]) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="px-2 py-2 font-semibold">check</th>
            <th className="px-2 py-2 font-semibold">status</th>
            <th className="px-2 py-2 font-semibold">detail</th>
            <th className="px-2 py-2 font-semibold">hint</th>
            <th className="px-2 py-2 font-semibold">last_updated_utc</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((check) => (
            <tr className="border-b align-top" key={check.key}>
              <td className="px-2 py-2">{check.label}</td>
              <td className={`px-2 py-2 font-semibold ${statusClassName(check.status)}`}>
                {healthStatusLabel(check.status)}
              </td>
              <td className="px-2 py-2">{check.detail}</td>
              <td className="px-2 py-2">{check.hint ?? "-"}</td>
              <td className="px-2 py-2">{formatUtcDate(check.last_updated_utc)}</td>
            </tr>
          ))}
          {checks.length === 0 ? (
            <tr>
              <td className="px-2 py-4 text-muted-foreground" colSpan={5}>
                No checks available.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
};

const renderAlerts = (alerts: AdminAnalyticsDataAlertRow[]) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
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
          {alerts.map((alert, index) => (
            <tr className="border-b align-top" key={`${alert.alert_name}:${alert.detected_at_utc}:${index}`}>
              <td className="px-2 py-2">{formatUtcDate(alert.detected_at_utc)}</td>
              <td className="px-2 py-2">{alert.alert_name}</td>
              <td className="px-2 py-2">{alert.severity}</td>
              <td className="px-2 py-2">{alert.tenant_id ?? "all"}</td>
              <td className="px-2 py-2">{alert.metric_value ?? "N/A"}</td>
              <td className="px-2 py-2">{alert.threshold_value ?? "N/A"}</td>
            </tr>
          ))}
          {alerts.length === 0 ? (
            <tr>
              <td className="px-2 py-4 text-muted-foreground" colSpan={6}>
                No recent alerts in selected range.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
};

const renderRemediationHints = (payload: AdminAnalyticsDataResponse | null) => {
  if (!payload) {
    return null;
  }

  const hasFreshnessIssues = payload.freshness.some((row) => row.status !== "ok");
  const hasAlertIssues = payload.alerts.some((alert) => {
    const severity = alert.severity.toLowerCase();
    return severity.includes("warn") || severity.includes("error") || severity.includes("critical");
  });

  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
      {hasFreshnessIssues ? (
        <li>
          Validate upstream ingestion for stale datasets, then rerun dbt models for the affected window.
        </li>
      ) : (
        <li>Freshness is within configured thresholds. Keep the existing schedule unchanged.</li>
      )}
      {hasAlertIssues ? (
        <li>
          Review recent rows in <code>marts.alert_events</code>, identify root cause, and document owner + ETA.
        </li>
      ) : (
        <li>No active alert events. Continue routine monitoring.</li>
      )}
      <li>
        If dbt marker is stale, check scheduler logs and rerun <code>dbt build</code> before re-checking this page.
      </li>
    </ul>
  );
};

export default async function AdminAnalyticsDataHealthPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const { payload, error } = await fetchDataHealth(resolvedSearchParams);

  return (
    <AdminAnalyticsPageScaffold
      description="Pipeline freshness, alert signals, and data reliability checks."
      links={[
        { href: "/admin/analytics/revenue", label: "Open revenue analytics" },
        { href: "/admin/analytics", label: "Back to analytics overview" }
      ]}
      title="Data health"
    >
      {error ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Load error</CardTitle>
            <CardDescription>Unable to fetch data health payload.</CardDescription>
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
          <CardTitle className="text-base">Overall state</CardTitle>
          <CardDescription>
            {payload ? `Generated at ${formatUtcDate(payload.generated_at_utc)}` : "No payload loaded."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payload ? (
            <p className={`text-sm font-semibold ${statusClassName(payload.status)}`}>
              {healthStatusLabel(payload.status)}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No status available.</p>
          )}
          <p className="mt-2 text-sm text-muted-foreground">
            Last dbt marker: {formatUtcDate(payload?.dbt_last_run?.finished_at_utc ?? null)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Freshness cards</CardTitle>
          <CardDescription>Configured thresholds are embedded in code and evaluated server-side.</CardDescription>
        </CardHeader>
        <CardContent>{renderFreshnessCards(payload?.freshness ?? [])}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checks</CardTitle>
          <CardDescription>Status summary for freshness, alerts, and dbt marker state.</CardDescription>
        </CardHeader>
        <CardContent>{renderChecks(payload?.checks ?? [])}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent alerts</CardTitle>
          <CardDescription>
            {payload?.alerts_available
              ? "Recent rows from marts.alert_events."
              : "alert_events table is unavailable in this environment."}
          </CardDescription>
        </CardHeader>
        <CardContent>{renderAlerts(payload?.alerts ?? [])}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Remediation hints</CardTitle>
          <CardDescription>Actionable guidance only; no automated actions in this stage.</CardDescription>
        </CardHeader>
        <CardContent>{renderRemediationHints(payload)}</CardContent>
      </Card>
    </AdminAnalyticsPageScaffold>
  );
}

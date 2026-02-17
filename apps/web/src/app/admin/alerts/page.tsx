import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "../../../components/ui/card";
import { getAdminCsrfTokenForRender } from "../../../lib/admin/csrf_server";
import { listAlertInstances } from "../../../lib/alerts/repo";
import {
  ALERT_INSTANCE_SEVERITIES,
  ALERT_INSTANCE_STATUSES,
  ALERT_RULE_TYPES,
  type AlertInstanceRecord,
  type AlertInstanceSeverity,
  type AlertInstanceStatus,
  type AlertRuleType
} from "../../../lib/alerts/types";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "../../../lib/admin/session";

type SearchParams = {
  status?: string | string[];
  severity?: string | string[];
  tenant_id?: string | string[];
  rule_type?: string | string[];
  updated?: string | string[];
  error?: string | string[];
  detail?: string | string[];
};

type PageProps = {
  searchParams?: SearchParams | Promise<SearchParams>;
};

const STATUS_SET = new Set<string>(ALERT_INSTANCE_STATUSES);
const SEVERITY_SET = new Set<string>(ALERT_INSTANCE_SEVERITIES);
const RULE_TYPE_SET = new Set<string>(ALERT_RULE_TYPES);

const asSingleValue = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

const normalizeStatus = (value: string | null): AlertInstanceStatus | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!STATUS_SET.has(normalized)) {
    return null;
  }

  return normalized as AlertInstanceStatus;
};

const normalizeSeverity = (value: string | null): AlertInstanceSeverity | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!SEVERITY_SET.has(normalized)) {
    return null;
  }

  return normalized as AlertInstanceSeverity;
};

const normalizeRuleType = (value: string | null): AlertRuleType | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!RULE_TYPE_SET.has(normalized)) {
    return null;
  }

  return normalized as AlertRuleType;
};

const normalizeText = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readFilters = async (
  searchParams: PageProps["searchParams"]
): Promise<{
  status: AlertInstanceStatus | null;
  severity: AlertInstanceSeverity | null;
  tenant_id: string | null;
  rule_type: AlertRuleType | null;
  updated: string | null;
  error: string | null;
  detail: string | null;
}> => {
  if (!searchParams) {
    return {
      status: null,
      severity: null,
      tenant_id: null,
      rule_type: null,
      updated: null,
      error: null,
      detail: null
    };
  }

  const resolved = await Promise.resolve(searchParams);
  return {
    status: normalizeStatus(asSingleValue(resolved.status)),
    severity: normalizeSeverity(asSingleValue(resolved.severity)),
    tenant_id: normalizeText(asSingleValue(resolved.tenant_id)),
    rule_type: normalizeRuleType(asSingleValue(resolved.rule_type)),
    updated: normalizeText(asSingleValue(resolved.updated)),
    error: normalizeText(asSingleValue(resolved.error)),
    detail: normalizeText(asSingleValue(resolved.detail))
  };
};

const contextText = (record: AlertInstanceRecord, key: string): string => {
  const value = record.context_json[key];
  if (typeof value === "string") {
    return value;
  }

  return "-";
};

const buildContextSummary = (record: AlertInstanceRecord): string => {
  const payload = JSON.stringify(record.context_json);
  if (payload.length <= 200) {
    return payload;
  }

  return `${payload.slice(0, 197)}...`;
};

const buildErrorMessage = (errorCode: string | null, detail: string | null): string | null => {
  if (!errorCode) {
    return null;
  }

  const suffix = detail ? ` (${detail})` : "";

  switch (errorCode) {
    case "unauthorized":
      return "You are not authorized for this action.";
    case "invalid_csrf":
      return "Request blocked by CSRF protection. Refresh and retry.";
    case "invalid_payload":
      return `Alert update payload is invalid${suffix}.`;
    case "not_found":
      return `Alert instance not found${suffix}.`;
    case "db_error":
      return "Alert update failed due to a database error.";
    default:
      return `Alert update failed (${errorCode})${suffix}.`;
  }
};

export default async function AdminAlertsPage({ searchParams }: PageProps) {
  const cookieStore = await cookies();
  const session = await verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    redirect("/admin/login");
  }

  const filters = await readFilters(searchParams);
  const csrfToken = await getAdminCsrfTokenForRender();

  let rows: AlertInstanceRecord[] = [];
  let loadError: string | null = null;

  try {
    rows = await listAlertInstances({
      status: filters.status,
      severity: filters.severity,
      tenant_id: filters.tenant_id,
      rule_type: filters.rule_type,
      limit: 200
    });
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unable to load alerts.";
  }

  const bannerError = buildErrorMessage(filters.error, filters.detail);
  const bannerSuccess = filters.updated === "ok" ? "Alert instance status updated." : null;

  return (
    <section className="mx-auto flex w-full flex-col gap-6 py-2">
      {bannerError ? (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-red-700" role="alert">
              {bannerError}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {bannerSuccess ? (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-emerald-700" role="status">
              {bannerSuccess}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Alerts</CardTitle>
          <CardDescription>
            Review fired alert instances and acknowledge or resolve operational follow-ups.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild type="button" variant="outline">
            <Link href="/admin/alerts/rules">Manage rules</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Filter by status, severity, tenant, and rule type.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 md:grid-cols-[220px_220px_minmax(0,1fr)_220px_auto_auto]"
            method="get"
          >
            <label className="space-y-1">
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                status
              </span>
              <select
                className="w-full rounded border bg-background px-2 py-2 text-sm"
                defaultValue={filters.status ?? ""}
                name="status"
              >
                <option value="">all</option>
                {ALERT_INSTANCE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                severity
              </span>
              <select
                className="w-full rounded border bg-background px-2 py-2 text-sm"
                defaultValue={filters.severity ?? ""}
                name="severity"
              >
                <option value="">all</option>
                {ALERT_INSTANCE_SEVERITIES.map((severity) => (
                  <option key={severity} value={severity}>
                    {severity}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                tenant_id
              </span>
              <input
                className="w-full rounded border bg-background px-2 py-2 text-sm"
                defaultValue={filters.tenant_id ?? ""}
                name="tenant_id"
                placeholder="tenant-..."
                type="text"
              />
            </label>

            <label className="space-y-1">
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                rule_type
              </span>
              <select
                className="w-full rounded border bg-background px-2 py-2 text-sm"
                defaultValue={filters.rule_type ?? ""}
                name="rule_type"
              >
                <option value="">all</option>
                {ALERT_RULE_TYPES.map((ruleType) => (
                  <option key={ruleType} value={ruleType}>
                    {ruleType}
                  </option>
                ))}
              </select>
            </label>

            <Button className="self-end" type="submit" variant="secondary">
              Apply filters
            </Button>
            <Button asChild className="self-end" type="button" variant="outline">
              <Link href="/admin/alerts">Clear</Link>
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alert instances</CardTitle>
          <CardDescription>Most recent first.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadError ? (
            <p className="text-sm text-red-700" role="alert">
              Failed to load alert instances: {loadError}
            </p>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1450px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 font-semibold">fired_at</th>
                  <th className="px-2 py-2 font-semibold">rule</th>
                  <th className="px-2 py-2 font-semibold">rule_type</th>
                  <th className="px-2 py-2 font-semibold">tenant_id</th>
                  <th className="px-2 py-2 font-semibold">severity</th>
                  <th className="px-2 py-2 font-semibold">status</th>
                  <th className="px-2 py-2 font-semibold">context</th>
                  <th className="px-2 py-2 font-semibold">actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length > 0 ? (
                  rows.map((record) => (
                    <tr className="border-b align-top" key={record.id}>
                      <td className="px-2 py-2">{record.fired_at}</td>
                      <td className="px-2 py-2">{record.rule_name}</td>
                      <td className="px-2 py-2">
                        <code>{record.rule_type}</code>
                      </td>
                      <td className="px-2 py-2">
                        <code>{contextText(record, "tenant_id")}</code>
                      </td>
                      <td className="px-2 py-2">{record.severity}</td>
                      <td className="px-2 py-2">{record.status}</td>
                      <td className="px-2 py-2">
                        <code className="break-all text-xs">{buildContextSummary(record)}</code>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-2">
                          {record.status !== "acknowledged" && record.status !== "resolved" ? (
                            <form
                              action={`/api/admin/alerts/instances/${encodeURIComponent(record.id)}?_method=PATCH`}
                              method="post"
                            >
                              <input name="csrf_token" type="hidden" value={csrfToken} />
                              <input name="status" type="hidden" value="acknowledged" />
                              <Button size="sm" type="submit" variant="secondary">
                                Acknowledge
                              </Button>
                            </form>
                          ) : null}

                          {record.status !== "resolved" ? (
                            <form
                              action={`/api/admin/alerts/instances/${encodeURIComponent(record.id)}?_method=PATCH`}
                              method="post"
                            >
                              <input name="csrf_token" type="hidden" value={csrfToken} />
                              <input name="status" type="hidden" value="resolved" />
                              <Button size="sm" type="submit" variant="outline">
                                Resolve
                              </Button>
                            </form>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-2 py-4 text-muted-foreground" colSpan={8}>
                      No alert instances found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

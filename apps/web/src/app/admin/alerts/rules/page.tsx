import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { getAdminCsrfTokenForRender } from "@/lib/admin/csrf_server";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin/session";
import { listAlertRules } from "@/lib/alerts/repo";
import { ALERT_RULE_TYPES, type AlertRuleRecord } from "@/lib/alerts/types";

type SearchParams = {
  created?: string | string[];
  updated?: string | string[];
  run?: string | string[];
  error?: string | string[];
  detail?: string | string[];
  rule_id?: string | string[];
};

type PageProps = {
  searchParams?: SearchParams | Promise<SearchParams>;
};

const asSingleValue = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

const normalizeText = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readState = async (
  searchParams: PageProps["searchParams"]
): Promise<{
  created: string | null;
  updated: string | null;
  run: string | null;
  error: string | null;
  detail: string | null;
  rule_id: string | null;
}> => {
  if (!searchParams) {
    return {
      created: null,
      updated: null,
      run: null,
      error: null,
      detail: null,
      rule_id: null
    };
  }

  const resolved = await Promise.resolve(searchParams);
  return {
    created: normalizeText(asSingleValue(resolved.created)),
    updated: normalizeText(asSingleValue(resolved.updated)),
    run: normalizeText(asSingleValue(resolved.run)),
    error: normalizeText(asSingleValue(resolved.error)),
    detail: normalizeText(asSingleValue(resolved.detail)),
    rule_id: normalizeText(asSingleValue(resolved.rule_id))
  };
};

const toPrettyJson = (value: Record<string, unknown>): string => {
  return JSON.stringify(value, null, 2);
};

const buildErrorMessage = (errorCode: string | null, detail: string | null): string | null => {
  if (!errorCode) {
    return null;
  }

  const suffix = detail ? ` (${detail})` : "";

  switch (errorCode) {
    case "unauthorized":
      return "You are not authorized for this action.";
    case "forbidden":
      return "Only admin can manage alert rules.";
    case "invalid_csrf":
      return "Request blocked by CSRF protection. Refresh and retry.";
    case "invalid_payload":
      return `Alert rule payload is invalid${suffix}.`;
    case "not_found":
      return `Alert rule not found${suffix}.`;
    case "run_failed":
      return `Run failed${suffix}.`;
    case "db_error":
      return "Alert rule update failed due to a database error.";
    default:
      return `Alert rule request failed (${errorCode})${suffix}.`;
  }
};

const findRuleById = (rules: AlertRuleRecord[], ruleId: string | null): AlertRuleRecord | null => {
  if (!ruleId) {
    return null;
  }

  const matched = rules.find((rule) => rule.id === ruleId);
  return matched ?? null;
};

export default async function AdminAlertRulesPage({ searchParams }: PageProps) {
  const cookieStore = await cookies();
  const session = await verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    redirect("/admin/login");
  }

  const state = await readState(searchParams);
  const csrfToken = await getAdminCsrfTokenForRender();

  let rules: AlertRuleRecord[] = [];
  let loadError: string | null = null;

  try {
    rules = await listAlertRules();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unable to load alert rules.";
  }

  const highlightedRule = findRuleById(rules, state.rule_id);
  const bannerError = buildErrorMessage(state.error, state.detail);

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

      {state.created === "ok" ? (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-emerald-700" role="status">
              Alert rule created.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {state.updated === "ok" ? (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-emerald-700" role="status">
              Alert rule updated.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {state.run === "ok" ? (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-emerald-700" role="status">
              Alert rule run completed.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Alert rules</CardTitle>
          <CardDescription>
            Create and maintain alert rule definitions used by the runner.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild type="button" variant="outline">
            <Link href="/admin/alerts">Back to alerts</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create rule</CardTitle>
          <CardDescription>
            Define name, type, scope, and params JSON. Scope and params default to empty objects.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/api/admin/alerts/rules" className="space-y-3" method="post">
            <input name="csrf_token" type="hidden" value={csrfToken} />

            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1">
                <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  name
                </span>
                <input
                  className="w-full rounded border bg-background px-2 py-2 text-sm"
                  name="name"
                  placeholder="Conversion drop, tenant alpha"
                  required
                  type="text"
                />
              </label>

              <label className="space-y-1">
                <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  rule_type
                </span>
                <select
                  className="w-full rounded border bg-background px-2 py-2 text-sm"
                  defaultValue={ALERT_RULE_TYPES[0]}
                  name="rule_type"
                >
                  {ALERT_RULE_TYPES.map((ruleType) => (
                    <option key={ruleType} value={ruleType}>
                      {ruleType}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  enabled
                </span>
                <select
                  className="w-full rounded border bg-background px-2 py-2 text-sm"
                  defaultValue="true"
                  name="enabled"
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  scope_json
                </span>
                <textarea
                  className="min-h-[120px] w-full rounded border bg-background px-2 py-2 font-mono text-xs"
                  defaultValue={"{}"}
                  name="scope_json"
                />
              </label>

              <label className="space-y-1">
                <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  params_json
                </span>
                <textarea
                  className="min-h-[120px] w-full rounded border bg-background px-2 py-2 font-mono text-xs"
                  defaultValue={"{}"}
                  name="params_json"
                />
              </label>
            </div>

            <Button type="submit" variant="secondary">
              Create rule
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rules</CardTitle>
          <CardDescription>Update existing rules or run one rule immediately.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadError ? (
            <p className="text-sm text-red-700" role="alert">
              Failed to load alert rules: {loadError}
            </p>
          ) : null}

          {rules.length > 0 ? (
            rules.map((rule) => (
              <div
                className="rounded border p-3"
                key={rule.id}
                style={{
                  borderColor: highlightedRule?.id === rule.id ? "rgb(16 185 129 / 0.7)" : undefined
                }}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{rule.name}</p>
                    <p className="text-xs text-muted-foreground">
                      id: <code>{rule.id}</code> | updated_at: {rule.updated_at}
                    </p>
                  </div>

                  <form
                    action={`/api/admin/alerts/rules/${encodeURIComponent(rule.id)}/run`}
                    method="post"
                  >
                    <input name="csrf_token" type="hidden" value={csrfToken} />
                    <Button size="sm" type="submit" variant="outline">
                      Run now
                    </Button>
                  </form>
                </div>

                <form
                  action={`/api/admin/alerts/rules/${encodeURIComponent(rule.id)}?_method=PATCH`}
                  className="space-y-3"
                  method="post"
                >
                  <input name="csrf_token" type="hidden" value={csrfToken} />

                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="space-y-1">
                      <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        name
                      </span>
                      <input
                        className="w-full rounded border bg-background px-2 py-2 text-sm"
                        defaultValue={rule.name}
                        name="name"
                        required
                        type="text"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        rule_type
                      </span>
                      <select
                        className="w-full rounded border bg-background px-2 py-2 text-sm"
                        defaultValue={rule.rule_type}
                        name="rule_type"
                      >
                        {ALERT_RULE_TYPES.map((ruleType) => (
                          <option key={ruleType} value={ruleType}>
                            {ruleType}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1">
                      <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        enabled
                      </span>
                      <select
                        className="w-full rounded border bg-background px-2 py-2 text-sm"
                        defaultValue={rule.enabled ? "true" : "false"}
                        name="enabled"
                      >
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    </label>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1">
                      <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        scope_json
                      </span>
                      <textarea
                        className="min-h-[120px] w-full rounded border bg-background px-2 py-2 font-mono text-xs"
                        defaultValue={toPrettyJson(rule.scope_json)}
                        name="scope_json"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        params_json
                      </span>
                      <textarea
                        className="min-h-[120px] w-full rounded border bg-background px-2 py-2 font-mono text-xs"
                        defaultValue={toPrettyJson(rule.params_json)}
                        name="params_json"
                      />
                    </label>
                  </div>

                  <Button size="sm" type="submit" variant="secondary">
                    Save rule
                  </Button>
                </form>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No alert rules found.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "../../components/ui/card";
import {
  listPublishTests,
  listTenantRegistry,
  type AdminPublishTest,
  type AdminTenantPublishState,
  type AdminTestVersion
} from "../../lib/admin/publish";
import { ADMIN_CSRF_FORM_FIELD } from "../../lib/admin/csrf";
import { getAdminCsrfTokenForRender } from "../../lib/admin/csrf_server";
import { readAdminDiagnostics } from "../../lib/admin/diagnostics";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "../../lib/admin/session";

type SearchParams = {
  publish?: string | string[];
  publish_error?: string | string[];
  rollback?: string | string[];
  rollback_error?: string | string[];
  detail?: string | string[];
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

const readPageState = async (
  searchParams: PageProps["searchParams"]
): Promise<{
  publish: string | null;
  publishError: string | null;
  rollback: string | null;
  rollbackError: string | null;
  detail: string | null;
}> => {
  if (!searchParams) {
    return {
      publish: null,
      publishError: null,
      rollback: null,
      rollbackError: null,
      detail: null
    };
  }

  const resolved = await Promise.resolve(searchParams);
  return {
    publish: asSingleValue(resolved.publish),
    publishError: asSingleValue(resolved.publish_error),
    rollback: asSingleValue(resolved.rollback),
    rollbackError: asSingleValue(resolved.rollback_error),
    detail: asSingleValue(resolved.detail)
  };
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
      return "Only admin can publish and rollback.";
    case "invalid_csrf":
      return "Request blocked by CSRF protection. Refresh the page and retry.";
    case "rate_limited":
      return `Too many publish requests${suffix}.`;
    case "invalid_payload":
      return `Publish payload is invalid${suffix}.`;
    case "invalid_test_id":
    case "invalid_version_id":
    case "invalid_tenant_ids":
    case "invalid_tenant_id":
    case "invalid_is_enabled":
      return `Invalid publish parameters${suffix}.`;
    case "unknown_tenant":
      return `Unknown tenant_id${suffix}.`;
    case "test_version_not_found":
      return `Selected version does not belong to the selected test${suffix}.`;
    case "staging_publish_required":
      return `Publish blocked: staging publish is required first${suffix}.`;
    case "publish_failed":
      return "Publish failed due to a server error.";
    case "rollback_failed":
      return "Rollback failed due to a server error.";
    default:
      return `Operation failed (${errorCode})${suffix}.`;
  }
};

const buildSuccessMessage = (state: {
  publish: string | null;
  rollback: string | null;
}): string | null => {
  if (state.publish === "ok") {
    return "Publish operation completed.";
  }

  if (state.rollback === "ok") {
    return "Rollback operation completed.";
  }

  return null;
};

const formatVersionLabel = (version: AdminTestVersion): string => {
  return `v${version.version} (${version.status})`;
};

const tenantCurrentVersionLabel = (
  tenantState: AdminTenantPublishState,
  versions: AdminTestVersion[]
): string => {
  if (!tenantState.published_version_id) {
    return "Not published";
  }

  const matching = versions.find((version) => version.id === tenantState.published_version_id);
  if (matching) {
    return formatVersionLabel(matching);
  }

  return tenantState.published_version
    ? `v${tenantState.published_version}`
    : tenantState.published_version_id;
};

const renderPublishCard = (
  testRecord: AdminPublishTest,
  tenantCount: number,
  csrfToken: string,
  publishActionsEnabled: boolean,
  publishActionsDisabledReason: string | null
) => {
  const hasVersions = testRecord.versions.length > 0;
  const latestVersionId = testRecord.versions[0]?.id ?? "";
  const actionsDisabled = !publishActionsEnabled;

  return (
    <Card key={testRecord.test_id}>
      <CardHeader>
        <CardTitle className="text-base">
          {testRecord.test_id} <span className="font-normal text-muted-foreground">({testRecord.slug})</span>
        </CardTitle>
        <CardDescription>
          Versions: {testRecord.versions.length} | Tenant bindings: {testRecord.tenant_states.length}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        {actionsDisabled ? (
          <div className="rounded border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
            {publishActionsDisabledReason ?? "Publish and rollback are disabled for this environment."}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-2 py-2 font-semibold">Version</th>
                <th className="px-2 py-2 font-semibold">Version ID</th>
                <th className="px-2 py-2 font-semibold">Created at</th>
                <th className="px-2 py-2 font-semibold">Created by</th>
              </tr>
            </thead>
            <tbody>
              {hasVersions ? (
                testRecord.versions.map((version) => (
                  <tr className="border-b align-top" key={version.id}>
                    <td className="px-2 py-2">{formatVersionLabel(version)}</td>
                    <td className="px-2 py-2">
                      <code className="break-all">{version.id}</code>
                    </td>
                    <td className="px-2 py-2">{version.created_at}</td>
                    <td className="px-2 py-2">{version.created_by ?? "unknown"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-2 py-2 text-muted-foreground" colSpan={4}>
                    No versions found for this test.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form action="/api/admin/publish" className="space-y-3 rounded border p-3" method="post">
          <input name={ADMIN_CSRF_FORM_FIELD} type="hidden" value={csrfToken} />
          <input name="test_id" type="hidden" value={testRecord.test_id} />
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Version
              </span>
              <select className="w-full rounded border bg-background px-2 py-2" name="version_id">
                {testRecord.versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {formatVersionLabel(version)}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                is_enabled
              </span>
              <select
                className="w-full rounded border bg-background px-2 py-2"
                defaultValue="true"
                name="is_enabled"
              >
                <option value="true">true (enabled)</option>
                <option value="false">false (disabled)</option>
              </select>
            </label>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Tenants
            </legend>
            <div className="grid gap-1 sm:grid-cols-2">
              {testRecord.tenant_states.map((tenantState) => (
                <label className="flex items-center gap-2" key={tenantState.tenant_id}>
                  <input
                    defaultChecked={tenantState.is_enabled}
                    name="tenant_ids"
                    type="checkbox"
                    value={tenantState.tenant_id}
                  />
                  <span>{tenantState.tenant_id}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <Button disabled={!hasVersions || tenantCount === 0 || actionsDisabled} type="submit">
            Publish selected version to selected tenants
          </Button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-2 py-2 font-semibold">Tenant</th>
                <th className="px-2 py-2 font-semibold">Enabled</th>
                <th className="px-2 py-2 font-semibold">Current version</th>
                <th className="px-2 py-2 font-semibold">Published at</th>
                <th className="px-2 py-2 font-semibold">Published by</th>
                <th className="px-2 py-2 font-semibold">Rollback</th>
                <th className="px-2 py-2 font-semibold">Enable/Disable</th>
              </tr>
            </thead>
            <tbody>
              {testRecord.tenant_states.map((tenantState) => {
                const toggleVersionId = tenantState.published_version_id ?? latestVersionId;
                return (
                  <tr className="border-b align-top" key={tenantState.tenant_id}>
                    <td className="px-2 py-2">
                      <code>{tenantState.tenant_id}</code>
                    </td>
                    <td className="px-2 py-2">{tenantState.is_enabled ? "true" : "false"}</td>
                    <td className="px-2 py-2">
                      {tenantCurrentVersionLabel(tenantState, testRecord.versions)}
                    </td>
                    <td className="px-2 py-2">{tenantState.published_at ?? "-"}</td>
                    <td className="px-2 py-2">{tenantState.published_by ?? "-"}</td>
                    <td className="px-2 py-2">
                      <form action="/api/admin/rollback" className="flex items-center gap-2" method="post">
                        <input name={ADMIN_CSRF_FORM_FIELD} type="hidden" value={csrfToken} />
                        <input name="test_id" type="hidden" value={testRecord.test_id} />
                        <input name="tenant_id" type="hidden" value={tenantState.tenant_id} />
                        <select
                          className="max-w-[240px] rounded border bg-background px-2 py-1"
                          defaultValue={tenantState.published_version_id ?? latestVersionId}
                          name="version_id"
                        >
                          {testRecord.versions.map((version) => (
                            <option key={version.id} value={version.id}>
                              {formatVersionLabel(version)}
                            </option>
                          ))}
                        </select>
                        <Button
                          disabled={!hasVersions || actionsDisabled}
                          size="sm"
                          type="submit"
                          variant="outline"
                        >
                          Rollback
                        </Button>
                      </form>
                    </td>
                    <td className="px-2 py-2">
                      <form action="/api/admin/publish" className="flex items-center gap-2" method="post">
                        <input name={ADMIN_CSRF_FORM_FIELD} type="hidden" value={csrfToken} />
                        <input name="test_id" type="hidden" value={testRecord.test_id} />
                        <input name="version_id" type="hidden" value={toggleVersionId} />
                        <input name="tenant_ids" type="hidden" value={tenantState.tenant_id} />
                        <input
                          name="is_enabled"
                          type="hidden"
                          value={tenantState.is_enabled ? "false" : "true"}
                        />
                        <Button
                          disabled={!toggleVersionId || actionsDisabled}
                          size="sm"
                          type="submit"
                          variant={tenantState.is_enabled ? "destructive" : "secondary"}
                        >
                          {tenantState.is_enabled ? "Disable" : "Enable"}
                        </Button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default async function AdminPage({ searchParams }: PageProps) {
  const cookieStore = await cookies();
  const session = await verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);

  if (!session) {
    redirect("/admin/login");
  }

  const pageState = await readPageState(searchParams);
  const successMessage = buildSuccessMessage({
    publish: pageState.publish,
    rollback: pageState.rollback
  });
  const publishErrorMessage = buildErrorMessage(pageState.publishError, pageState.detail);
  const rollbackErrorMessage = buildErrorMessage(pageState.rollbackError, pageState.detail);

  let publishTests: AdminPublishTest[] = [];
  let loadError: string | null = null;

  try {
    publishTests = await listPublishTests();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unable to load publish workflow data.";
  }

  const tenantRegistry = listTenantRegistry();
  const diagnostics = await readAdminDiagnostics();
  const csrfToken = await getAdminCsrfTokenForRender();

  return (
    <section className="mx-auto flex w-full flex-col gap-6 py-2">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card>
          <CardHeader>
            <CardTitle>Admin console</CardTitle>
            <CardDescription>
              Authenticated as <strong>{session.role}</strong>. Session expires at{" "}
              {new Date(session.expires_at).toISOString()}.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session controls</CardTitle>
            <CardDescription>
              Admin routes are protected by middleware and signed session cookies.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action="/api/admin/logout" method="post">
              <input name={ADMIN_CSRF_FORM_FIELD} type="hidden" value={csrfToken} />
              <Button type="submit" variant="outline">
                Log out
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick actions</CardTitle>
          <CardDescription>
            Upload multi-locale markdown bundles and preview source metadata before conversion.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild type="button">
            <Link href="/admin/imports/new">Create import bundle</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Diagnostics</CardTitle>
          <CardDescription>Operational checks for publish and rollback safety.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <dl className="grid gap-2 sm:grid-cols-[260px_minmax(0,1fr)]">
            <dt className="font-medium text-muted-foreground">NODE_ENV</dt>
            <dd>
              <code>{diagnostics.nodeEnv}</code>
            </dd>

            {diagnostics.commitSha ? (
              <>
                <dt className="font-medium text-muted-foreground">COMMIT_SHA</dt>
                <dd>
                  <code>{diagnostics.commitSha}</code>
                </dd>
              </>
            ) : null}

            <dt className="font-medium text-muted-foreground">CONTENT_SOURCE (resolved)</dt>
            <dd>
              <code>{diagnostics.contentSource}</code>
            </dd>

            <dt className="font-medium text-muted-foreground">CONTENT_DATABASE_URL configured</dt>
            <dd>{diagnostics.contentDatabaseUrlConfigured ? "yes" : "no"}</dd>

            <dt className="font-medium text-muted-foreground">Tenants registry count</dt>
            <dd>{diagnostics.tenantRegistryCount}</dd>

            <dt className="font-medium text-muted-foreground">Content DB migrations applied</dt>
            <dd>{diagnostics.contentDbMigrationsApplied ? "yes" : "no"}</dd>
          </dl>

          {diagnostics.criticalWarnings.length > 0 ? (
            <div className="rounded border border-amber-400 bg-amber-50 px-3 py-2 text-amber-900" role="alert">
              <p className="font-medium">Warning: publish guardrails are not fully satisfied.</p>
              <ul className="list-disc pl-5">
                {diagnostics.criticalWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Publish workflow</CardTitle>
          <CardDescription>
            Publish selected versions to tenants, rollback by version ID, and toggle tenant enable state.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Tenant registry source: <code>config/tenants.json</code> ({tenantRegistry.length} tenants)
          </p>

          {successMessage ? (
            <p className="text-sm text-green-700" role="status">
              {successMessage}
            </p>
          ) : null}

          {publishErrorMessage ? (
            <p className="text-sm text-red-700" role="alert">
              {publishErrorMessage}
            </p>
          ) : null}

          {rollbackErrorMessage ? (
            <p className="text-sm text-red-700" role="alert">
              {rollbackErrorMessage}
            </p>
          ) : null}

          {loadError ? (
            <p className="text-sm text-red-700" role="alert">
              Failed to load publish workflow data: {loadError}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {!loadError && publishTests.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            No tests found in content DB yet.
          </CardContent>
        </Card>
      ) : null}

      {!loadError ? (
        <section aria-label="Test publish controls" className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Test publish controls</h2>
            <p className="text-sm text-muted-foreground">
              Manage versions and tenant enablement state for each test.
            </p>
          </div>
          {publishTests.map((testRecord) =>
            renderPublishCard(
              testRecord,
              tenantRegistry.length,
              csrfToken,
              diagnostics.publishActionsEnabled,
              diagnostics.publishActionsDisabledReason
            )
          )}
        </section>
      ) : null}
    </section>
  );
}

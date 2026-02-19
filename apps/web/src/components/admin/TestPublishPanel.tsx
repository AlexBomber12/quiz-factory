"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { logger } from "@/lib/logger";

import { ADMIN_CSRF_FORM_FIELD, ADMIN_CSRF_HEADER } from "../../lib/admin/csrf";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

type TenantOption = {
  tenant_id: string;
  domains: string[];
};

type VersionOption = {
  version_id: string;
  version: number;
};

type PublicationState = {
  tenant_id: string;
  is_enabled: boolean;
  published_version_id: string | null;
};

type TestPublishPanelProps = {
  testId: string;
  csrfToken: string;
  tenants: TenantOption[];
  versions: VersionOption[];
  publications: PublicationState[];
  publishActionsEnabled?: boolean;
  publishActionsDisabledMessage?: string | null;
};

type PanelMessage =
  | {
      kind: "success" | "error";
      text: string;
    }
  | null;

const formatTenantOption = (tenant: TenantOption): string => {
  if (tenant.domains.length === 0) {
    return tenant.tenant_id;
  }

  return `${tenant.tenant_id} (${tenant.domains.join(", ")})`;
};

const buildErrorMessage = (code: string | null, detail: string | null): string => {
  const suffix = detail ? ` (${detail})` : "";

  switch (code) {
    case "unauthorized":
      return "Session expired. Please sign in again.";
    case "forbidden":
      return "Only admin can run this action.";
    case "invalid_csrf":
      return "Request blocked by CSRF protection. Refresh and retry.";
    case "rate_limited":
      return `Too many requests${suffix}.`;
    case "invalid_payload":
      return `Action payload is invalid${suffix}.`;
    case "invalid_test_id":
    case "invalid_version_id":
    case "invalid_tenant_ids":
    case "invalid_tenant_id":
    case "invalid_is_enabled":
      return `Invalid publish parameters${suffix}.`;
    case "unknown_tenant":
      return `Unknown tenant${suffix}.`;
    case "test_version_not_found":
      return "Selected version does not belong to this test.";
    case "staging_publish_required":
      return `Publish blocked: staging publish is required first${suffix}.`;
    case "publish_failed":
      return "Publish failed due to a server error.";
    case "rollback_failed":
      return "Rollback failed due to a server error.";
    default:
      return code ? `Action failed (${code})${suffix}.` : "Action failed.";
  }
};

const readErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as {
      error?: unknown;
      detail?: unknown;
    };
    const errorCode = typeof payload.error === "string" ? payload.error : null;
    const detail = typeof payload.detail === "string" ? payload.detail : null;
    return buildErrorMessage(errorCode, detail);
  } catch (error) {
    logger.warn({ error }, "components/admin/TestPublishPanel.tsx fallback handling failed");
    return `Action failed with status ${response.status}.`;
  }
};

export default function TestPublishPanel({
  testId,
  csrfToken,
  tenants,
  versions,
  publications,
  publishActionsEnabled = true,
  publishActionsDisabledMessage = null
}: TestPublishPanelProps) {
  const router = useRouter();
  const [publishTenantId, setPublishTenantId] = useState(tenants[0]?.tenant_id ?? "");
  const [publishVersionId, setPublishVersionId] = useState(versions[0]?.version_id ?? "");
  const [rollbackTenantId, setRollbackTenantId] = useState(tenants[0]?.tenant_id ?? "");
  const [rollbackVersionId, setRollbackVersionId] = useState(versions[0]?.version_id ?? "");
  const [toggleTenantId, setToggleTenantId] = useState(tenants[0]?.tenant_id ?? "");
  const [toggleVersionId, setToggleVersionId] = useState(versions[0]?.version_id ?? "");
  const [pendingAction, setPendingAction] = useState<"publish" | "rollback" | "toggle" | null>(null);
  const [message, setMessage] = useState<PanelMessage>(null);

  const publicationByTenant = useMemo(() => {
    return new Map(publications.map((entry) => [entry.tenant_id, entry]));
  }, [publications]);

  const selectedTogglePublication = publicationByTenant.get(toggleTenantId) ?? null;
  const resolvedToggleVersionId = selectedTogglePublication?.published_version_id ?? toggleVersionId;
  const nextToggleEnabled = !(selectedTogglePublication?.is_enabled ?? false);

  const runRequest = async (url: string, payload: Record<string, unknown>): Promise<void> => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        [ADMIN_CSRF_HEADER]: csrfToken
      },
      body: JSON.stringify({
        ...payload,
        [ADMIN_CSRF_FORM_FIELD]: csrfToken
      })
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }
  };

  const runAction = async (
    action: "publish" | "rollback" | "toggle",
    handler: () => Promise<void>
  ) => {
    setMessage(null);
    setPendingAction(action);

    try {
      await handler();
      setMessage({
        kind: "success",
        text:
          action === "publish"
            ? "Publish operation completed."
            : action === "rollback"
              ? "Rollback operation completed."
              : "Enable state updated."
      });
      router.refresh();
    } catch (error) {
      setMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "Action failed."
      });
    } finally {
      setPendingAction(null);
    }
  };

  const hasTenants = tenants.length > 0;
  const hasVersions = versions.length > 0;
  const actionsDisabled = !publishActionsEnabled;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Publish actions</CardTitle>
        <CardDescription>
          Publish or rollback by tenant and version. Enable toggle uses the currently published version when
          available.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {actionsDisabled ? (
          <p className="rounded border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
            {publishActionsDisabledMessage ??
              "Publish and rollback actions are disabled. Configure CONTENT_SOURCE=db and CONTENT_DATABASE_URL."}
          </p>
        ) : null}

        {message ? (
          <p
            className={message.kind === "error" ? "text-sm text-red-700" : "text-sm text-green-700"}
            role={message.kind === "error" ? "alert" : "status"}
          >
            {message.text}
          </p>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3">
          <form
            className="space-y-3 rounded border p-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!publishTenantId || !publishVersionId || actionsDisabled) {
                return;
              }

              void runAction("publish", () =>
                runRequest("/api/admin/publish", {
                  test_id: testId,
                  tenant_ids: [publishTenantId],
                  version_id: publishVersionId,
                  is_enabled: true
                })
              );
            }}
          >
            <p className="text-sm font-medium">Publish</p>

            <label className="space-y-1">
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Tenant
              </span>
              <select
                className="w-full rounded border bg-background px-2 py-2 text-sm"
                disabled={actionsDisabled}
                onChange={(event) => setPublishTenantId(event.target.value)}
                value={publishTenantId}
              >
                {tenants.map((tenant) => (
                  <option key={tenant.tenant_id} value={tenant.tenant_id}>
                    {formatTenantOption(tenant)}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Version
              </span>
              <select
                className="w-full rounded border bg-background px-2 py-2 text-sm"
                disabled={actionsDisabled}
                onChange={(event) => setPublishVersionId(event.target.value)}
                value={publishVersionId}
              >
                {versions.map((version) => (
                  <option key={version.version_id} value={version.version_id}>
                    v{version.version}
                  </option>
                ))}
              </select>
            </label>

            <Button
              disabled={!hasTenants || !hasVersions || pendingAction !== null || actionsDisabled}
              type="submit"
            >
              Publish
            </Button>
          </form>

          <form
            className="space-y-3 rounded border p-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!rollbackTenantId || !rollbackVersionId || actionsDisabled) {
                return;
              }

              void runAction("rollback", () =>
                runRequest("/api/admin/rollback", {
                  test_id: testId,
                  tenant_id: rollbackTenantId,
                  version_id: rollbackVersionId
                })
              );
            }}
          >
            <p className="text-sm font-medium">Rollback</p>

            <label className="space-y-1">
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Tenant
              </span>
              <select
                className="w-full rounded border bg-background px-2 py-2 text-sm"
                disabled={actionsDisabled}
                onChange={(event) => setRollbackTenantId(event.target.value)}
                value={rollbackTenantId}
              >
                {tenants.map((tenant) => (
                  <option key={tenant.tenant_id} value={tenant.tenant_id}>
                    {formatTenantOption(tenant)}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Version
              </span>
              <select
                className="w-full rounded border bg-background px-2 py-2 text-sm"
                disabled={actionsDisabled}
                onChange={(event) => setRollbackVersionId(event.target.value)}
                value={rollbackVersionId}
              >
                {versions.map((version) => (
                  <option key={version.version_id} value={version.version_id}>
                    v{version.version}
                  </option>
                ))}
              </select>
            </label>

            <Button
              disabled={!hasTenants || !hasVersions || pendingAction !== null || actionsDisabled}
              type="submit"
              variant="outline"
            >
              Rollback
            </Button>
          </form>

          <form
            className="space-y-3 rounded border p-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!toggleTenantId || !resolvedToggleVersionId || actionsDisabled) {
                return;
              }

              void runAction("toggle", () =>
                runRequest("/api/admin/publish", {
                  test_id: testId,
                  tenant_ids: [toggleTenantId],
                  version_id: resolvedToggleVersionId,
                  is_enabled: nextToggleEnabled
                })
              );
            }}
          >
            <p className="text-sm font-medium">Enable toggle</p>

            <label className="space-y-1">
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Tenant
              </span>
              <select
                className="w-full rounded border bg-background px-2 py-2 text-sm"
                disabled={actionsDisabled}
                onChange={(event) => setToggleTenantId(event.target.value)}
                value={toggleTenantId}
              >
                {tenants.map((tenant) => (
                  <option key={tenant.tenant_id} value={tenant.tenant_id}>
                    {formatTenantOption(tenant)}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Fallback version
              </span>
              <select
                className="w-full rounded border bg-background px-2 py-2 text-sm"
                disabled={actionsDisabled}
                onChange={(event) => setToggleVersionId(event.target.value)}
                value={toggleVersionId}
              >
                {versions.map((version) => (
                  <option key={version.version_id} value={version.version_id}>
                    v{version.version}
                  </option>
                ))}
              </select>
            </label>

            <p className="text-xs text-muted-foreground">
              {selectedTogglePublication?.published_version_id
                ? "Will use the tenant's currently published version."
                : "No published version yet; fallback version will be used."}
            </p>

            <Button
              disabled={
                !hasTenants ||
                !hasVersions ||
                !resolvedToggleVersionId ||
                pendingAction !== null ||
                actionsDisabled
              }
              type="submit"
              variant={nextToggleEnabled ? "secondary" : "destructive"}
            >
              {nextToggleEnabled ? "Enable" : "Disable"}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}

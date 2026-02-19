import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { logger } from "@/lib/logger";

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
import {
  getAlertAiInsightByInstanceId,
  listAlertInstances
} from "@/lib/alerts/repo";
import type { AlertAiInsightRecord, AlertInstanceRecord } from "@/lib/alerts/types";

import ActionCenterClient from "./action-center-client";

type SearchParams = {
  alert_id?: string | string[];
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

const normalizeSearchParams = async (
  searchParams: PageProps["searchParams"]
): Promise<{ alertId: string | null }> => {
  if (!searchParams) {
    return { alertId: null };
  }

  const resolved = await Promise.resolve(searchParams);
  const alertId = asSingleValue(resolved.alert_id)?.trim();
  return {
    alertId: alertId && alertId.length > 0 ? alertId : null
  };
};

const resolveInitialSelection = (alerts: AlertInstanceRecord[], selectedId: string | null): string | null => {
  if (selectedId && alerts.some((alert) => alert.id === selectedId)) {
    return selectedId;
  }
  return alerts[0]?.id ?? null;
};

export default async function AdminActionCenterPage({ searchParams }: PageProps) {
  const cookieStore = await cookies();
  const session = await verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    redirect("/admin/login");
  }

  const csrfToken = await getAdminCsrfTokenForRender();
  const params = await normalizeSearchParams(searchParams);

  let alerts: AlertInstanceRecord[] = [];
  let loadError: string | null = null;

  try {
    alerts = await listAlertInstances({ limit: 200 });
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unable to load alert instances.";
  }

  const initialSelectedAlertId = resolveInitialSelection(alerts, params.alertId);
  let initialInsight: AlertAiInsightRecord | null = null;
  if (initialSelectedAlertId) {
    try {
      initialInsight = await getAlertAiInsightByInstanceId(initialSelectedAlertId);
    } catch (error) {
      logger.error({ error }, "app/admin/action-center/page.tsx operation failed");
      initialInsight = null;
    }
  }

  return (
    <section className="mx-auto flex w-full flex-col gap-6 py-2">
      <Card>
        <CardHeader>
          <CardTitle>Action Center</CardTitle>
          <CardDescription>
            AI-generated insights and recommended actions for fired alert instances.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild type="button" variant="outline">
            <Link href="/admin/alerts">Back to alerts</Link>
          </Button>
        </CardContent>
      </Card>

      {loadError ? (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-red-700" role="alert">
              Failed to load alerts: {loadError}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <ActionCenterClient
        alerts={alerts}
        csrfToken={csrfToken}
        initialInsight={initialInsight}
        initialSelectedAlertId={initialSelectedAlertId}
      />
    </section>
  );
}

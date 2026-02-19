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
import {
  listAdminAuditEvents,
  type AdminAuditEventRecord
} from "@/lib/admin/audit";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin/session";

type SearchParams = {
  q?: string | string[];
  action?: string | string[];
};

type PageProps = {
  searchParams?: SearchParams | Promise<SearchParams>;
};

const ACTION_OPTIONS = [
  "admin_login",
  "admin_logout",
  "import_uploaded",
  "import_converted",
  "test_published",
  "test_rollback",
  "alert_rule_created",
  "alert_rule_updated",
  "alert_rule_run",
  "alert_instance_acknowledged",
  "alert_instance_resolved",
  "alert_instance_updated"
] as const;

const asSingleValue = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

const readFilters = async (
  searchParams: PageProps["searchParams"]
): Promise<{ q: string | null; action: string | null }> => {
  if (!searchParams) {
    return { q: null, action: null };
  }

  const resolved = await Promise.resolve(searchParams);
  return {
    q: asSingleValue(resolved.q),
    action: asSingleValue(resolved.action)
  };
};

const truncate = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) {
    return value;
  }

  if (maxLength <= 3) {
    return value.slice(0, maxLength);
  }

  return `${value.slice(0, maxLength - 3)}...`;
};

const buildMetadataSummary = (metadata: Record<string, unknown>): string => {
  return truncate(JSON.stringify(metadata), 160);
};

const renderActor = (record: AdminAuditEventRecord): string => {
  return record.actor || "unknown";
};

export default async function AdminAuditPage({ searchParams }: PageProps) {
  const cookieStore = await cookies();
  const session = await verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    redirect("/admin/login");
  }

  const filters = await readFilters(searchParams);
  let records: AdminAuditEventRecord[] = [];
  let loadError: string | null = null;

  try {
    records = await listAdminAuditEvents({
      q: filters.q,
      action: filters.action,
      limit: 100,
      offset: 0
    });
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unable to load audit events.";
  }

  return (
    <section className="mx-auto flex w-full flex-col gap-6 py-2">
      <Card>
        <CardHeader>
          <CardTitle>Audit log</CardTitle>
          <CardDescription>
            Review recent admin actions captured in admin_audit_events.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>
            Search by actor, action, or entity_id and optionally match a single action.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto_auto]" method="get">
            <label className="space-y-1">
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                q
              </span>
              <input
                className="w-full rounded border bg-background px-2 py-2 text-sm"
                defaultValue={filters.q ?? ""}
                name="q"
                placeholder="actor, action, or entity_id"
                type="search"
              />
            </label>

            <label className="space-y-1">
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                action
              </span>
              <select
                className="w-full rounded border bg-background px-2 py-2 text-sm"
                defaultValue={filters.action ?? ""}
                name="action"
              >
                <option value="">all</option>
                {ACTION_OPTIONS.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </label>

            <Button className="self-end" type="submit" variant="secondary">
              Apply filters
            </Button>
            <Button asChild className="self-end" type="button" variant="outline">
              <Link href="/admin/audit">Clear</Link>
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent events</CardTitle>
          <CardDescription>Most recent first.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadError ? (
            <p className="text-sm text-red-700" role="alert">
              Failed to load audit events: {loadError}
            </p>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 font-semibold">occurred_at</th>
                  <th className="px-2 py-2 font-semibold">actor</th>
                  <th className="px-2 py-2 font-semibold">action</th>
                  <th className="px-2 py-2 font-semibold">entity_type</th>
                  <th className="px-2 py-2 font-semibold">entity_id</th>
                  <th className="px-2 py-2 font-semibold">metadata summary</th>
                </tr>
              </thead>
              <tbody>
                {records.length > 0 ? (
                  records.map((record) => (
                    <tr className="border-b align-top" key={`${record.occurred_at}:${record.action}:${record.entity_id}`}>
                      <td className="px-2 py-2">{record.occurred_at}</td>
                      <td className="px-2 py-2">{renderActor(record)}</td>
                      <td className="px-2 py-2">{record.action}</td>
                      <td className="px-2 py-2">{record.entity_type}</td>
                      <td className="px-2 py-2">
                        <code className="break-all">{record.entity_id}</code>
                      </td>
                      <td className="px-2 py-2">
                        <code className="break-all text-xs">{buildMetadataSummary(record.metadata)}</code>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-2 py-4 text-muted-foreground" colSpan={6}>
                      No audit events found.
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

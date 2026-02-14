import Link from "next/link";

import AdminAnalyticsPageScaffold from "../../../../components/admin/analytics/PageScaffold";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";

const PLACEHOLDER_TENANT_IDS = ["tenant-quizfactory-en", "tenant-quizfactory-es"];

export default function AdminAnalyticsTenantsPage() {
  return (
    <AdminAnalyticsPageScaffold
      description="Tenants-level analytics listing placeholder."
      links={[
        { href: "/admin/analytics", label: "Back to analytics overview" },
        { href: "/admin/analytics/distribution", label: "Open distribution matrix" }
      ]}
      title="Tenants analytics"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tenants table</CardTitle>
          <CardDescription>
            Placeholder rows that link to detail routes using <code>tenant_id</code> params.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 font-semibold">tenant_id</th>
                  <th className="px-2 py-2 font-semibold">domain</th>
                  <th className="px-2 py-2 font-semibold">link</th>
                </tr>
              </thead>
              <tbody>
                {PLACEHOLDER_TENANT_IDS.map((tenantId) => (
                  <tr className="border-b align-top" key={tenantId}>
                    <td className="px-2 py-2">
                      <code>{tenantId}</code>
                    </td>
                    <td className="px-2 py-2">placeholder.example.com</td>
                    <td className="px-2 py-2">
                      <Link
                        className="text-primary underline underline-offset-4 hover:no-underline"
                        href={`/admin/analytics/tenants/${encodeURIComponent(tenantId)}`}
                      >
                        Open detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </AdminAnalyticsPageScaffold>
  );
}

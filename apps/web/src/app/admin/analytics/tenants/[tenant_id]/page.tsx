import Link from "next/link";

import AdminAnalyticsPageScaffold from "../../../../../components/admin/analytics/PageScaffold";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../../components/ui/card";

type PageProps = {
  params: Promise<{ tenant_id: string }> | { tenant_id: string };
};

const resolveParams = async (
  params: PageProps["params"]
): Promise<{ tenant_id: string }> => {
  return Promise.resolve(params);
};

export default async function AdminAnalyticsTenantDetailPage({ params }: PageProps) {
  const resolvedParams = await resolveParams(params);
  const encodedTenantId = encodeURIComponent(resolvedParams.tenant_id);

  return (
    <AdminAnalyticsPageScaffold
      description="Single-tenant analytics detail placeholder."
      links={[
        { href: "/admin/analytics/tenants", label: "Back to tenants analytics" },
        {
          href: `/admin/analytics/distribution?tenant_id=${encodedTenantId}`,
          label: "Open distribution filtered by this tenant"
        },
        {
          href: `/admin/analytics/traffic?tenant_id=${encodedTenantId}`,
          label: "Open traffic filtered by this tenant"
        }
      ]}
      title="Tenant analytics detail"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tenant detail placeholder</CardTitle>
          <CardDescription>
            Selected <code>tenant_id</code>: <code>{resolvedParams.tenant_id}</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Tenant KPI cards, channel breakdowns, and conversion trend blocks are deferred to later PRs.
          </p>
          <Link
            className="mt-3 inline-block text-primary underline underline-offset-4 hover:no-underline"
            href={`/admin/analytics/tenants?tenant_id=${encodedTenantId}`}
          >
            Back to list with this tenant_id in filters
          </Link>
        </CardContent>
      </Card>
    </AdminAnalyticsPageScaffold>
  );
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import AdminAnalyticsPageScaffold from "../../../components/admin/analytics/PageScaffold";

export default function AdminAnalyticsOverviewPage() {
  return (
    <AdminAnalyticsPageScaffold
      description="Analytics workspace scaffold for global, tenant, and test-level reporting."
      links={[
        { href: "/admin/analytics/tests", label: "Open tests analytics" },
        { href: "/admin/analytics/tenants", label: "Open tenants analytics" },
        { href: "/admin/analytics/distribution", label: "Open distribution matrix" },
        { href: "/admin/analytics/traffic", label: "Open traffic analytics" },
        { href: "/admin/analytics/revenue", label: "Open revenue analytics" },
        { href: "/admin/analytics/data", label: "Open data health" }
      ]}
      title="Analytics overview"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Global overview</CardTitle>
          <CardDescription>Placeholder for KPI cards and trend charts (BigQuery wiring in next PRs).</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This page intentionally renders only the shell and filter controls in this step.
          </p>
        </CardContent>
      </Card>
    </AdminAnalyticsPageScaffold>
  );
}

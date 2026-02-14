import AdminAnalyticsPageScaffold from "../../../../components/admin/analytics/PageScaffold";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";

export default function AdminAnalyticsDistributionPage() {
  return (
    <AdminAnalyticsPageScaffold
      description="Tenant x test matrix placeholder."
      links={[
        { href: "/admin/analytics/tests", label: "Open tests analytics" },
        { href: "/admin/analytics/tenants", label: "Open tenants analytics" }
      ]}
      title="Distribution matrix"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Matrix placeholder</CardTitle>
          <CardDescription>
            This view will show coverage and quick metrics across <code>tenant_id</code> x{" "}
            <code>test_id</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The scaffold exists to validate route wiring and shared filters before data integration.
          </p>
        </CardContent>
      </Card>
    </AdminAnalyticsPageScaffold>
  );
}

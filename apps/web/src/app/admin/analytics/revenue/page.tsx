import AdminAnalyticsPageScaffold from "../../../../components/admin/analytics/PageScaffold";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";

export default function AdminAnalyticsRevenuePage() {
  return (
    <AdminAnalyticsPageScaffold
      description="Revenue analytics placeholder for gross, refunds, disputes, and fees."
      links={[
        { href: "/admin/analytics/data", label: "Open data health" },
        { href: "/admin/analytics", label: "Back to analytics overview" }
      ]}
      title="Revenue analytics"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue placeholder</CardTitle>
          <CardDescription>Future iterations will add finance KPIs and time-series charts.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This scaffold confirms route-level integration and shared filter behavior.
          </p>
        </CardContent>
      </Card>
    </AdminAnalyticsPageScaffold>
  );
}

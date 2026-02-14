import AdminAnalyticsPageScaffold from "../../../../components/admin/analytics/PageScaffold";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";

export default function AdminAnalyticsDataHealthPage() {
  return (
    <AdminAnalyticsPageScaffold
      description="Data health placeholder for freshness and coverage diagnostics."
      links={[
        { href: "/admin/analytics/revenue", label: "Open revenue analytics" },
        { href: "/admin/analytics", label: "Back to analytics overview" }
      ]}
      title="Data health"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data health placeholder</CardTitle>
          <CardDescription>Freshness checks and alert summaries will be connected in later PRs.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The current implementation intentionally focuses on routing, layout, and filter consistency.
          </p>
        </CardContent>
      </Card>
    </AdminAnalyticsPageScaffold>
  );
}

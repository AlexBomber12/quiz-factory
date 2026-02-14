import AdminAnalyticsPageScaffold from "../../../../components/admin/analytics/PageScaffold";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";

export default function AdminAnalyticsTrafficPage() {
  return (
    <AdminAnalyticsPageScaffold
      description="Traffic analytics placeholder for channels, referrers, devices, and locale mix."
      links={[
        { href: "/admin/analytics/tenants", label: "Open tenants analytics" },
        { href: "/admin/analytics/tests", label: "Open tests analytics" }
      ]}
      title="Traffic analytics"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Traffic placeholder</CardTitle>
          <CardDescription>UTM, device, and locale slices will be wired in a follow-up PR.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Filter controls are already connected to querystring and can be used for manual route checks.
          </p>
        </CardContent>
      </Card>
    </AdminAnalyticsPageScaffold>
  );
}

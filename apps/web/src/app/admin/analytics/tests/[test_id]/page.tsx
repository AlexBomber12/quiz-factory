import Link from "next/link";

import AdminAnalyticsPageScaffold from "../../../../../components/admin/analytics/PageScaffold";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../../components/ui/card";

type PageProps = {
  params: Promise<{ test_id: string }> | { test_id: string };
};

const resolveParams = async (
  params: PageProps["params"]
): Promise<{ test_id: string }> => {
  return Promise.resolve(params);
};

export default async function AdminAnalyticsTestDetailPage({ params }: PageProps) {
  const resolvedParams = await resolveParams(params);
  const encodedTestId = encodeURIComponent(resolvedParams.test_id);

  return (
    <AdminAnalyticsPageScaffold
      description="Single-test analytics detail placeholder."
      links={[
        { href: "/admin/analytics/tests", label: "Back to tests analytics" },
        {
          href: `/admin/analytics/distribution?test_id=${encodedTestId}`,
          label: "Open distribution filtered by this test"
        },
        {
          href: `/admin/analytics/revenue?test_id=${encodedTestId}`,
          label: "Open revenue filtered by this test"
        }
      ]}
      title="Test analytics detail"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Test detail placeholder</CardTitle>
          <CardDescription>
            Selected <code>test_id</code>: <code>{resolvedParams.test_id}</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            KPI trends, funnel slices, and locale/device splits will be added in follow-up PRs.
          </p>
          <Link
            className="mt-3 inline-block text-primary underline underline-offset-4 hover:no-underline"
            href={`/admin/analytics/tests?test_id=${encodedTestId}`}
          >
            Back to list with this test_id in filters
          </Link>
        </CardContent>
      </Card>
    </AdminAnalyticsPageScaffold>
  );
}

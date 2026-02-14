import Link from "next/link";

import AdminAnalyticsPageScaffold from "../../../../components/admin/analytics/PageScaffold";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";

const PLACEHOLDER_TEST_IDS = ["test-focus-rhythm", "test-energy-balance"];

export default function AdminAnalyticsTestsPage() {
  return (
    <AdminAnalyticsPageScaffold
      description="Tests-level analytics listing placeholder."
      links={[
        { href: "/admin/analytics", label: "Back to analytics overview" },
        { href: "/admin/analytics/distribution", label: "Open distribution matrix" }
      ]}
      title="Tests analytics"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tests table</CardTitle>
          <CardDescription>
            Placeholder rows that link to detail routes using <code>test_id</code> params.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 font-semibold">test_id</th>
                  <th className="px-2 py-2 font-semibold">name</th>
                  <th className="px-2 py-2 font-semibold">link</th>
                </tr>
              </thead>
              <tbody>
                {PLACEHOLDER_TEST_IDS.map((testId) => (
                  <tr className="border-b align-top" key={testId}>
                    <td className="px-2 py-2">
                      <code>{testId}</code>
                    </td>
                    <td className="px-2 py-2">Placeholder test title</td>
                    <td className="px-2 py-2">
                      <Link
                        className="text-primary underline underline-offset-4 hover:no-underline"
                        href={`/admin/analytics/tests/${encodeURIComponent(testId)}`}
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

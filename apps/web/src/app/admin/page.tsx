import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "../../components/ui/card";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "../../lib/admin/session";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const session = await verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);

  if (!session) {
    redirect("/admin/login");
  }

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Admin console</CardTitle>
          <CardDescription>
            Authenticated as <strong>{session.role}</strong>. Session expires at{" "}
            {new Date(session.expires_at).toISOString()}.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session controls</CardTitle>
          <CardDescription>
            Admin routes are protected by middleware and signed session cookies.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="post" action="/api/admin/logout">
            <Button type="submit" variant="outline">
              Log out
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}

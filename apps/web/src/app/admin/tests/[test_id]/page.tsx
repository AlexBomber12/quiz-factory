import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "../../../../components/ui/card";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "../../../../lib/admin/session";

type PageProps = {
  params: Promise<{ test_id: string }> | { test_id: string };
};

const resolveParams = async (
  params: PageProps["params"]
): Promise<{ test_id: string }> => {
  return Promise.resolve(params);
};

export default async function AdminTestDetailPlaceholderPage({ params }: PageProps) {
  const cookieStore = await cookies();
  const session = await verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    redirect("/admin/login");
  }

  const resolvedParams = await resolveParams(params);

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-2">
      <Card>
        <CardHeader>
          <CardTitle>Test detail</CardTitle>
          <CardDescription>
            test_id: <code>{resolvedParams.test_id}</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Detail page coming next PR.</p>
        </CardContent>
      </Card>
    </section>
  );
}

import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "../../../lib/admin/session";

type AnalyticsLayoutProps = {
  children: ReactNode;
};

export default async function AnalyticsLayout({ children }: AnalyticsLayoutProps) {
  const cookieStore = await cookies();
  const session = await verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    redirect("/admin/login");
  }

  return children;
}

import type { Metadata } from "next";

import { PublicNav } from "../../components/public/PublicNav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { buildHubPageMetadata } from "../../lib/hub/metadata";

export const generateMetadata = async (): Promise<Metadata> => {
  return buildHubPageMetadata({
    path: "/cookies",
    title: "Cookies",
    description: "Learn how cookies are used by this site."
  });
};

export default function CookiesPage() {
  return (
    <section className="flex flex-col gap-6">
      <PublicNav />
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-3xl">Cookies</CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            Cookies help maintain session continuity and core product behavior.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Essential cookies support test progress and secure account-level flows.</p>
          <p>Analytics cookies may be used in aggregate to improve product quality.</p>
        </CardContent>
      </Card>
    </section>
  );
}

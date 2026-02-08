import type { Metadata } from "next";

import { PublicNav } from "../../components/public/PublicNav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { buildHubPageMetadata } from "../../lib/hub/metadata";

export const generateMetadata = async (): Promise<Metadata> => {
  return buildHubPageMetadata({
    path: "/terms",
    title: "Terms",
    description: "Review basic terms for using this test portal."
  });
};

export default function TermsPage() {
  return (
    <section className="flex flex-col gap-6">
      <PublicNav />
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-3xl">Terms</CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            By using this site, you agree to basic usage and content terms.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Do not misuse automated scripts or attempt to interfere with service availability.</p>
          <p>Content is provided as-is without guarantees of personal outcomes.</p>
        </CardContent>
      </Card>
    </section>
  );
}

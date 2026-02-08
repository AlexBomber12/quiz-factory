import type { Metadata } from "next";

import { PublicNav } from "../../components/public/PublicNav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { buildHubPageMetadata } from "../../lib/hub/metadata";

export const generateMetadata = async (): Promise<Metadata> => {
  return buildHubPageMetadata({
    path: "/about",
    title: "About",
    description: "Learn what this tenant test portal provides."
  });
};

export default function AboutPage() {
  return (
    <section className="flex flex-col gap-6">
      <PublicNav />
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-3xl">About</CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            This site publishes short self-assessment tests and educational summaries.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Tests are intended for informational use only.</p>
          <p>Results can support reflection, but they are not a diagnosis or treatment plan.</p>
        </CardContent>
      </Card>
    </section>
  );
}

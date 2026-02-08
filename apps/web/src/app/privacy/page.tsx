import type { Metadata } from "next";

import { PublicNav } from "../../components/public/PublicNav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { buildHubPageMetadata } from "../../lib/hub/metadata";

export const generateMetadata = async (): Promise<Metadata> => {
  return buildHubPageMetadata({
    path: "/privacy",
    title: "Privacy",
    description: "Review the privacy practices for this test portal."
  });
};

export default function PrivacyPage() {
  return (
    <section className="flex flex-col gap-6">
      <PublicNav />
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-3xl">Privacy</CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            We collect only the data needed to deliver tests and reports.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Personal data is limited and processed according to configured retention rules.</p>
          <p>We do not sell personal information.</p>
        </CardContent>
      </Card>
    </section>
  );
}

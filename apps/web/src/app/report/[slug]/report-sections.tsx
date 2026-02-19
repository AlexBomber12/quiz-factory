"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { emitUpsellAccept, emitUpsellView } from "@/lib/product/client";

type ScaleEntry = {
  scale: string;
  value: number;
};

type ReportBand = {
  headline?: string | null;
  summary?: string | null;
  bullets?: string[] | null;
};

const DEFAULT_UPSELL_ID = "pack5";

const resolveString = (value: string | null | undefined, fallback: string): string => {
  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

const resolveBullets = (value: string[] | null | undefined): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
};

const creditsMessage = (balance: number): string => {
  if (balance === 1) {
    return "You have 1 credit remaining.";
  }
  return `You have ${balance} credits remaining.`;
};

const useResolvedLocale = (): string => {
  return useMemo(() => {
    if (typeof document !== "undefined") {
      const docLocale = document.documentElement.lang;
      if (docLocale && docLocale.trim().length > 0) {
        return docLocale.trim();
      }
    }

    if (typeof navigator !== "undefined" && navigator.language) {
      return navigator.language;
    }

    return "en";
  }, []);
};

const formatReportDate = (locale: string): string => {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(new Date());
  }
};

export function ReportHeader({
  reportTitle,
  creditsBalanceAfter
}: {
  reportTitle: string | null | undefined;
  creditsBalanceAfter: number;
}) {
  const locale = useResolvedLocale();
  const formattedDate = useMemo(() => formatReportDate(locale), [locale]);
  const safeTitle = resolveString(reportTitle, "Your paid report");

  return (
    <Card className="border-border/60 shadow-sm print:shadow-none">
      <CardHeader className="space-y-4 pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="eyebrow">Quiz Factory</p>
            <CardTitle className="text-3xl sm:text-4xl">{safeTitle}</CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              Your paid report is ready. Save it, print it, and revisit it anytime.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge
              variant="outline"
              className="text-xs uppercase tracking-wide text-muted-foreground"
            >
              {locale}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {formattedDate}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm font-medium text-foreground">
          {creditsMessage(creditsBalanceAfter)}
        </p>
      </CardContent>
    </Card>
  );
}

export function ReportSummary({ band }: { band: ReportBand }) {
  const headline = resolveString(band.headline ?? null, "Your result overview");
  const summary = resolveString(
    band.summary ?? null,
    "We could not load a written summary for this result."
  );
  const bullets = resolveBullets(band.bullets);

  return (
    <Card className="border-border/60 shadow-sm print:shadow-none">
      <CardHeader className="space-y-3">
        <Badge variant="secondary" className="w-fit">
          Summary
        </Badge>
        <CardTitle className="text-2xl">{headline}</CardTitle>
        <CardDescription className="text-base text-muted-foreground">{summary}</CardDescription>
      </CardHeader>
      {bullets.length > 0 ? (
        <CardContent className="pt-0">
          <ul className="list-disc space-y-2 pl-5 text-sm text-foreground">
            {bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </CardContent>
      ) : null}
    </Card>
  );
}

const resolveScaleMax = (entries: ReadonlyArray<ScaleEntry>): number => {
  const maxValue = entries.reduce((max, entry) => {
    if (!Number.isFinite(entry.value)) {
      return max;
    }
    return Math.max(max, entry.value);
  }, 0);

  return maxValue > 0 ? maxValue : 1;
};

const resolvePercent = (value: number, maxValue: number): number => {
  if (!Number.isFinite(value) || maxValue <= 0) {
    return 0;
  }

  const rawPercent = Math.round((value / maxValue) * 100);
  return Math.min(100, Math.max(0, rawPercent));
};

export function ScoreSection({
  scaleEntries,
  totalScore
}: {
  scaleEntries: ReadonlyArray<ScaleEntry>;
  totalScore: number;
}) {
  const hasEntries = scaleEntries.length > 0;
  const scaleMax = resolveScaleMax(scaleEntries);
  const safeTotalScore = Number.isFinite(totalScore) ? totalScore : 0;

  return (
    <Card className="border-border/60 shadow-sm print:shadow-none">
      <CardHeader className="space-y-3">
        <Badge variant="secondary" className="w-fit">
          Scores
        </Badge>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-2xl">Score breakdown</CardTitle>
          <Badge variant="outline" className="w-fit text-sm font-semibold">
            Total {safeTotalScore}
          </Badge>
        </div>
        <CardDescription className="text-base text-muted-foreground">
          Each scale highlights a different dimension of the result.
        </CardDescription>
      </CardHeader>
      {hasEntries ? (
        <CardContent className="flex flex-col gap-5 pt-0">
          {scaleEntries.map((entry) => {
            const safeValue = Number.isFinite(entry.value) ? entry.value : 0;
            const percent = resolvePercent(safeValue, scaleMax);
            return (
              <div key={entry.scale} className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{entry.scale}</span>
                  <Badge variant="outline" className="font-semibold">
                    {safeValue}
                  </Badge>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      ) : (
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground">
            A detailed score breakdown is not available for this report.
          </p>
        </CardContent>
      )}
    </Card>
  );
}

export function InterpretationSection({ band }: { band: ReportBand }) {
  const headline = resolveString(band.headline ?? null, "What this result suggests");
  const summary = resolveString(
    band.summary ?? null,
    "Interpretation details are not available right now."
  );
  const bullets = resolveBullets(band.bullets);

  const interpretationBullets =
    bullets.length > 0
      ? bullets
      : [
          "Treat this as a starting point for reflection rather than a final verdict.",
          "Notice which statements feel accurate and which ones you want to challenge.",
          "Use the next steps below to turn the insight into action."
        ];

  return (
    <Card className="border-border/60 shadow-sm print:shadow-none">
      <CardHeader className="space-y-3">
        <Badge variant="secondary" className="w-fit">
          Interpretation
        </Badge>
        <CardTitle className="text-2xl">{headline}</CardTitle>
        <CardDescription className="text-base text-muted-foreground">{summary}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="list-disc space-y-2 pl-5 text-sm text-foreground">
          {interpretationBullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

const NEXT_STEPS = [
  "Pick one small change to try in the next 24 hours.",
  "Share a key takeaway with someone you trust to test how it lands.",
  "Retake the quiz in a few weeks to compare trends, not perfection."
];

export function NextStepsSection() {
  return (
    <Card className="border-border/60 shadow-sm print:shadow-none">
      <CardHeader className="space-y-3">
        <Badge variant="secondary" className="w-fit">
          Next steps
        </Badge>
        <CardTitle className="text-2xl">How to use this report</CardTitle>
        <CardDescription className="text-base text-muted-foreground">
          These suggestions are practical and non-medical.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="list-disc space-y-2 pl-5 text-sm text-foreground">
          {NEXT_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function DisclaimerSection() {
  return (
    <Card className="border-dashed border-border/80 bg-muted/20 shadow-none">
      <CardHeader className="space-y-2">
        <Badge variant="outline" className="w-fit">
          Disclaimer
        </Badge>
        <CardTitle className="text-xl">Not a diagnosis</CardTitle>
        <CardDescription className="text-base text-muted-foreground">
          This report is informational and educational. It is not medical advice, diagnosis, or
          treatment. If you have concerns, consult a qualified professional.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

export function UpsellSection({
  testId,
  sessionId,
  purchaseId,
  slug,
  creditsBalanceAfter,
  upsellId = DEFAULT_UPSELL_ID
}: {
  testId: string;
  sessionId: string;
  purchaseId: string;
  slug: string;
  creditsBalanceAfter: number;
  upsellId?: string;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasEmittedViewRef = useRef(false);
  const paywallParams = new URLSearchParams({
    offer_key: upsellId,
    is_upsell: "true"
  });
  const paywallHref = `/t/${slug}/pay?${paywallParams.toString()}`;
  const creditsLine =
    creditsBalanceAfter > 0 ? creditsMessage(creditsBalanceAfter) : "You have no credits remaining.";

  useEffect(() => {
    if (hasEmittedViewRef.current) {
      return;
    }
    hasEmittedViewRef.current = true;

    void emitUpsellView({
      test_id: testId,
      session_id: sessionId,
      purchase_id: purchaseId,
      upsell_id: upsellId
    }).catch(() => null);
  }, [purchaseId, sessionId, testId, upsellId]);

  const handleClick = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await emitUpsellAccept({
        test_id: testId,
        session_id: sessionId,
        purchase_id: purchaseId,
        upsell_id: upsellId
      });
    } catch {
      // Best-effort analytics; continue to paywall.
    } finally {
      router.push(paywallHref);
    }
  };

  return (
    <Card className="border-primary/20 bg-primary/5 shadow-sm print:hidden">
      <CardHeader className="space-y-3">
        <Badge className="w-fit">Get more reports</Badge>
        <CardTitle className="text-2xl">Keep the momentum going</CardTitle>
        <CardDescription className="text-base text-muted-foreground">
          {creditsLine} Packs make it easier to compare results over time.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="list-disc space-y-2 pl-5 text-sm text-foreground">
          <li>Track progress by retaking the quiz after meaningful changes.</li>
          <li>Compare results across different periods or contexts.</li>
          <li>Share a future report with someone you trust for accountability.</li>
        </ul>
      </CardContent>
      <Separator className="bg-primary/20" />
      <CardFooter className="flex flex-col items-start gap-3 pt-5 sm:flex-row sm:items-center">
        <Button type="button" disabled={isSubmitting} onClick={handleClick}>
          {isSubmitting ? "Opening paywall..." : "Get more reports"}
        </Button>
        <p className="text-xs text-muted-foreground">Recommended: 5-report pack</p>
      </CardFooter>
    </Card>
  );
}

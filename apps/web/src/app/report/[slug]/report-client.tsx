"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import ReportAnalytics from "./report-analytics";
import ReportPdfButton from "./report-pdf-button";
import {
  DisclaimerSection,
  InterpretationSection,
  NextStepsSection,
  ReportHeader,
  ReportSummary,
  ScoreSection,
  UpsellSection
} from "./report-sections";

type ScaleEntry = {
  scale: string;
  value: number;
};

type ReportAccessPayload = {
  ok: true;
  report: {
    test_id: string;
    slug: string;
    report_title: string;
    band: {
      headline: string;
      summary: string;
      bullets: string[];
    };
    scale_entries: ScaleEntry[];
    total_score: number;
  };
  purchase_id: string;
  session_id: string;
  credits_balance_after: number;
  consumed_credit: boolean;
};

type ReportClientProps = {
  slug: string;
  testId: string;
};

type LoadState =
  | { status: "loading" }
  | { status: "blocked" }
  | { status: "error"; message: string }
  | { status: "ready"; payload: ReportAccessPayload };

const paywallHrefForSlug = (slug: string): string => `/t/${slug}/pay`;
const testHrefForSlug = (slug: string): string => `/t/${slug}`;

export default function ReportClient({ slug, testId }: ReportClientProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    const loadReport = async () => {
      setState({ status: "loading" });

      let response: Response | null = null;
      try {
        response = await fetch("/api/report/access", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({ slug })
        });
      } catch {
        response = null;
      }

      if (cancelled) {
        return;
      }

      if (!response) {
        setState({
          status: "error",
          message: "We could not load your report."
        });
        return;
      }

      if (response.status === 402) {
        let paywallUrl = paywallHrefForSlug(slug);
        try {
          const payload = (await response.json()) as { paywall_url?: string };
          if (payload.paywall_url) {
            paywallUrl = payload.paywall_url;
          }
        } catch {
          paywallUrl = paywallHrefForSlug(slug);
        }
        window.location.assign(paywallUrl);
        return;
      }

      if (response.status === 401 || response.status === 403) {
        setState({ status: "blocked" });
        return;
      }

      if (!response.ok) {
        setState({
          status: "error",
          message: "We could not load your report."
        });
        return;
      }

      let payload: ReportAccessPayload | null = null;
      try {
        payload = (await response.json()) as ReportAccessPayload;
      } catch {
        payload = null;
      }

      if (!payload?.ok || payload.report.test_id !== testId) {
        setState({ status: "blocked" });
        return;
      }

      setState({ status: "ready", payload });
    };

    void loadReport();

    return () => {
      cancelled = true;
    };
  }, [slug, testId]);

  if (state.status === "loading") {
    return (
      <section className="page">
        <header className="hero">
          <p className="eyebrow">Quiz Factory</p>
          <h1>Loading your report</h1>
          <p>This should only take a moment.</p>
        </header>
      </section>
    );
  }

  if (state.status === "blocked") {
    return (
      <section className="page">
        <header className="hero">
          <p className="eyebrow">Quiz Factory</p>
          <h1>Report locked</h1>
          <p>This report is available after checkout. Please return to the test to unlock it.</p>
        </header>
        <Link className="primary-button" href={testHrefForSlug(slug)}>
          Back to the test
        </Link>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="page">
        <header className="hero">
          <p className="eyebrow">Quiz Factory</p>
          <h1>Report unavailable</h1>
          <p>{state.message}</p>
        </header>
        <Link className="primary-button" href={testHrefForSlug(slug)}>
          Back to the test
        </Link>
      </section>
    );
  }

  const { payload } = state;
  const { report, purchase_id: purchaseId, session_id: sessionId } = payload;
  const balanceAfter = payload.credits_balance_after;

  return (
    <section className="page">
      <ReportAnalytics
        testId={report.test_id}
        purchaseId={purchaseId}
        sessionId={sessionId}
        consumedCredit={payload.consumed_credit}
        creditsBalanceAfter={balanceAfter}
      />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <ReportHeader reportTitle={report.report_title} creditsBalanceAfter={balanceAfter} />
        <ReportSummary band={report.band} />
        <ScoreSection scaleEntries={report.scale_entries} totalScore={report.total_score} />
        <InterpretationSection band={report.band} />
        <NextStepsSection />
        <DisclaimerSection />
        <UpsellSection
          testId={report.test_id}
          sessionId={sessionId}
          purchaseId={purchaseId}
          slug={report.slug}
          creditsBalanceAfter={balanceAfter}
        />

        <div className="flex flex-col items-start gap-3 print:hidden sm:flex-row sm:items-center">
          <ReportPdfButton testId={report.test_id} purchaseId={purchaseId} slug={report.slug} />
          <Link className="text-link" href={testHrefForSlug(report.slug)}>
            Back to the test
          </Link>
        </div>
      </div>
    </section>
  );
}

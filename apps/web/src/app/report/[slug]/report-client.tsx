"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import GeneratedReport, { parseGeneratedReportJson } from "./generated-report";
import ReportAnalytics from "./report-analytics";
import ReportPdfButton from "./report-pdf-button";
import ReportShare from "./report-share";
import type { ReportPdfMode } from "@/lib/report/pdf_mode";
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
  generated?: {
    report_json: unknown;
    style_id: string;
    model: string;
    prompt_version: string;
    scoring_version: string;
  };
};

type ReportClientProps = {
  slug: string;
  testId: string;
  sharePath: string;
  shareUrl: string | null;
  reportLinkToken: string | null;
  reportLinkUrl: string | null;
  shareTitle: string;
  pdfMode: ReportPdfMode;
};

type LoadState =
  | { status: "loading" }
  | { status: "generating" }
  | { status: "blocked" }
  | { status: "error"; message: string }
  | { status: "ready"; payload: ReportAccessPayload };

const paywallHrefForSlug = (slug: string): string => `/t/${slug}/pay`;
const testHrefForSlug = (slug: string): string => `/t/${slug}`;
const POLL_DELAYS_MS = [500, 1000, 2000, 3000, 5000] as const;
const MAX_GENERATING_WAIT_MS = 30_000;

const resolveGenerationError = (value: unknown): string => {
  if (value === "report not generated") {
    return "Your report is not generated yet.";
  }

  if (value === "result summary missing") {
    return "Your report data is still being prepared.";
  }

  return "We could not load your report.";
};

export default function ReportClient({
  slug,
  testId,
  sharePath,
  shareUrl,
  reportLinkToken,
  reportLinkUrl,
  shareTitle,
  pdfMode
}: ReportClientProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    const startedAtMs = Date.now();

    const loadReport = async (attempt: number, showLoadingState: boolean) => {
      if (showLoadingState) {
        setState({ status: "loading" });
      }

      const requestUrl = reportLinkToken
        ? `/api/report/access?t=${encodeURIComponent(reportLinkToken)}`
        : "/api/report/access";

      let response: Response | null = null;
      try {
        const payload: Record<string, unknown> = { slug };
        if (reportLinkToken) {
          payload.report_link_token = reportLinkToken;
        }

        response = await fetch(requestUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify(payload)
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

      if (response.status === 202) {
        const elapsedMs = Date.now() - startedAtMs;
        if (elapsedMs >= MAX_GENERATING_WAIT_MS) {
          setState({
            status: "error",
            message: "Report generation is taking longer than expected."
          });
          return;
        }

        setState({ status: "generating" });
        const delayMs = POLL_DELAYS_MS[Math.min(attempt, POLL_DELAYS_MS.length - 1)];
        retryTimeout = setTimeout(() => {
          void loadReport(attempt + 1, false);
        }, delayMs);
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

      if (response.status === 409) {
        let error: unknown = null;
        try {
          const payload = (await response.json()) as { error?: unknown };
          error = payload.error;
        } catch {
          error = null;
        }

        setState({
          status: "error",
          message: resolveGenerationError(error)
        });
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

    void loadReport(0, true);

    return () => {
      cancelled = true;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [slug, testId, reportLinkToken]);

  if (state.status === "loading" || state.status === "generating") {
    const isGenerating = state.status === "generating";
    return (
      <section className="page">
        <header className="hero">
          <p className="eyebrow">Quiz Factory</p>
          <h1>{isGenerating ? "Generating your report" : "Loading your report"}</h1>
          <p>
            {isGenerating
              ? "This can take up to 30 seconds. Please keep this page open."
              : "This should only take a moment."}
          </p>
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
  const generatedReport = payload.generated
    ? parseGeneratedReportJson(payload.generated.report_json)
    : null;

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
        {generatedReport ? (
          <GeneratedReport reportJson={generatedReport} />
        ) : (
          <>
            <ReportSummary band={report.band} />
            <ScoreSection scaleEntries={report.scale_entries} totalScore={report.total_score} />
            <InterpretationSection band={report.band} />
            <NextStepsSection />
            <DisclaimerSection />
          </>
        )}
        <ReportShare
          testId={report.test_id}
          sessionId={sessionId}
          sharePath={sharePath}
          shareUrl={shareUrl}
          reportLinkUrl={reportLinkUrl}
          shareTitle={shareTitle}
        />
        <UpsellSection
          testId={report.test_id}
          sessionId={sessionId}
          purchaseId={purchaseId}
          slug={report.slug}
          creditsBalanceAfter={balanceAfter}
        />

        <div className="flex flex-col items-start gap-3 print:hidden sm:flex-row sm:items-center">
          <ReportPdfButton
            testId={report.test_id}
            purchaseId={purchaseId}
            slug={report.slug}
            pdfMode={pdfMode}
            reportLinkToken={reportLinkToken}
          />
          <Link className="text-link" href={testHrefForSlug(report.slug)}>
            Back to the test
          </Link>
        </div>
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import GeneratedReport, { parseGeneratedReportJson } from "../generated-report";
import ReportAnalytics from "../report-analytics";
import PrintTrigger from "./print-trigger";
import styles from "./print.module.css";

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

type PrintClientProps = {
  slug: string;
  testId: string;
  reportLinkToken: string | null;
};

type LoadState =
  | { status: "loading" }
  | { status: "generating" }
  | { status: "blocked" }
  | { status: "error"; message: string }
  | { status: "ready"; payload: ReportAccessPayload };

const paywallHrefForSlug = (slug: string): string => `/t/${slug}/pay`;
const reportHrefForSlug = (slug: string, reportLinkToken: string | null): string =>
  reportLinkToken
    ? `/report/${slug}?t=${encodeURIComponent(reportLinkToken)}`
    : `/report/${slug}`;
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

export default function PrintClient({ slug, testId, reportLinkToken }: PrintClientProps) {
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
      <section className={`page ${styles.reportPrint}`}>
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
      <section className={`page ${styles.reportPrint}`}>
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
      <section className={`page ${styles.reportPrint}`}>
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
  const generatedReport = payload.generated
    ? parseGeneratedReportJson(payload.generated.report_json)
    : null;

  return (
    <section className={`page ${styles.reportPrint}`}>
      <ReportAnalytics
        testId={report.test_id}
        purchaseId={purchaseId}
        sessionId={sessionId}
        consumedCredit={payload.consumed_credit}
        creditsBalanceAfter={payload.credits_balance_after}
      />
      <header className="hero">
        <p className="eyebrow">Quiz Factory</p>
        <h1>{report.report_title}</h1>
        <p>Print-friendly report.</p>
      </header>

      <div className={styles.printControls}>
        <PrintTrigger />
        <Link className="text-link" href={reportHrefForSlug(report.slug, reportLinkToken)}>
          Back to report
        </Link>
      </div>

      {generatedReport ? (
        <GeneratedReport reportJson={generatedReport} />
      ) : (
        <div className="runner-card">
          <h2 className="runner-question">{report.band.headline}</h2>
          <p>{report.band.summary}</p>
          <ul>
            {report.band.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </div>
      )}

      {report.scale_entries.length > 0 ? (
        <div className="runner-card">
          <h2 className="runner-question">Score breakdown</h2>
          <div className="test-meta">
            {report.scale_entries.map((entry) => (
              <div key={entry.scale}>
                <strong>{entry.scale}:</strong> {entry.value}
              </div>
            ))}
            <div>
              <strong>Total score:</strong> {report.total_score}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

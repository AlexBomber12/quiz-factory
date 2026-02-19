import { env } from "@/lib/env";
import { NextResponse } from "next/server";

import { parseCookies } from "@/lib/analytics/session";
import {
  CREDITS_COOKIE,
  CREDITS_COOKIE_TTL_SECONDS,
  consumeCreditForReport,
  createReportKey,
  parseCreditsCookie,
  serializeCreditsCookie,
  type CreditsState
} from "@/lib/credits";
import { loadPublishedTestBySlug } from "@/lib/content/provider";
import type { LocalizedTest, TestSpec } from "@/lib/content/types";
import { REPORT_TOKEN, verifyReportToken } from "@/lib/product/report_token";
import { RESULT_COOKIE, verifyResultCookie } from "@/lib/product/result_cookie";
import { getAttemptSummary } from "@/lib/report/attempt_summary_repo";
import { generateLlmReport } from "@/lib/report/llm_report_generator";
import { PROMPT_VERSION } from "@/lib/report/llm_report_schema";
import { buildReportBrief, SCORING_VERSION } from "@/lib/report/report_brief";
import {
  getReportArtifactByPurchaseId,
  type ReportArtifactRecord,
  upsertReportArtifact
} from "@/lib/report/report_artifact_repo";
import { enqueueReportJob, getReportJobByPurchaseId, markJobReady } from "@/lib/report/report_job_repo";
import { inferStyleIdFromBrief } from "@/lib/report/style_inference";
import { verifyReportLinkToken } from "@/lib/report_link_token";
import { withApiGuards } from "@/lib/security/with_api_guards";
import { resolveTenantContext } from "@/lib/tenants/request";

const DEFAULT_OPENAI_MODEL = "gpt-4o";

type ScaleEntry = {
  scale: string;
  value: number;
};

type ReportPayload = {
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

type GeneratedPayload = {
  report_json: unknown;
  style_id: string;
  model: string;
  prompt_version: string;
  scoring_version: string;
};

type AccessPayload = {
  ok: true;
  report: ReportPayload;
  purchase_id: string;
  session_id: string;
  credits_balance_after: number;
  consumed_credit: boolean;
  generated?: GeneratedPayload;
};

type AccessContext = {
  purchase_id: string;
  tenant_id: string;
  test_id: string;
  session_id: string;
  locale: string;
  spec: TestSpec;
  payload: AccessPayload;
  credits_state: CreditsState | null;
};

type GeneratedResolution =
  | { kind: "ready"; generated: GeneratedPayload }
  | { kind: "generating" }
  | { kind: "blocked"; error: "report not generated" | "result summary missing" };

const requireString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const requireRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const hasOpenAiApiKey = (): boolean => Boolean(requireString(env.OPENAI_API_KEY));

const resolveModel = (): string => requireString(env.OPENAI_MODEL) ?? DEFAULT_OPENAI_MODEL;

const buildScaleEntries = (scaleScores: Record<string, number>): ScaleEntry[] => {
  return Object.entries(scaleScores)
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([scale, value]) => ({ scale, value }));
};

const buildReportPayload = (
  test: LocalizedTest,
  bandId: string,
  scaleScores: Record<string, number>
): ReportPayload | null => {
  const band = test.result_bands.find((candidate) => candidate.band_id === bandId);
  const bandCopy = band?.copy[test.locale];
  if (!band || !bandCopy) {
    return null;
  }

  const scaleEntries = buildScaleEntries(scaleScores);
  const totalScore = scaleEntries.reduce((sum, entry) => sum + entry.value, 0);

  return {
    test_id: test.test_id,
    slug: test.slug,
    report_title: test.report_title,
    band: {
      headline: bandCopy.headline,
      summary: bandCopy.summary,
      bullets: bandCopy.bullets
    },
    scale_entries: scaleEntries,
    total_score: totalScore
  };
};

const toGeneratedPayload = (artifact: ReportArtifactRecord): GeneratedPayload => {
  return {
    report_json: artifact.report_json,
    style_id: artifact.style_id,
    model: artifact.model,
    prompt_version: artifact.prompt_version,
    scoring_version: artifact.scoring_version
  };
};

const withGeneratedPayload = (
  payload: AccessPayload,
  generated: GeneratedPayload
): AccessPayload => {
  return {
    ...payload,
    generated
  };
};

const buildReadyResponse = (
  payload: AccessPayload,
  creditsState: CreditsState | null
): NextResponse<AccessPayload> => {
  return withCreditsCookie(NextResponse.json(payload), creditsState);
};

const withCreditsCookie = <T>(
  response: NextResponse<T>,
  creditsState: CreditsState | null
): NextResponse<T> => {
  if (creditsState) {
    response.cookies.set(CREDITS_COOKIE, serializeCreditsCookie(creditsState), {
      httpOnly: true,
      maxAge: CREDITS_COOKIE_TTL_SECONDS,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production"
    });
  }

  return response;
};

const resolveGeneratedContent = async (
  context: AccessContext
): Promise<GeneratedResolution> => {
  const artifact = await getReportArtifactByPurchaseId(context.purchase_id, {
    tenant_id: context.tenant_id,
    test_id: context.test_id,
    session_id: context.session_id
  });

  if (artifact) {
    return {
      kind: "ready",
      generated: toGeneratedPayload(artifact)
    };
  }

  if (!hasOpenAiApiKey()) {
    return {
      kind: "blocked",
      error: "report not generated"
    };
  }

  let job = await getReportJobByPurchaseId(context.purchase_id);
  if (!job) {
    job = await enqueueReportJob({
      purchase_id: context.purchase_id,
      tenant_id: context.tenant_id,
      test_id: context.test_id,
      session_id: context.session_id,
      locale: context.locale
    });

    if (!job) {
      job = await getReportJobByPurchaseId(context.purchase_id);
    }
  }

  if (job?.status === "running") {
    return {
      kind: "generating"
    };
  }

  const summary = await getAttemptSummary(
    context.tenant_id,
    context.test_id,
    context.session_id
  );
  if (!summary) {
    return {
      kind: "blocked",
      error: "result summary missing"
    };
  }

  const brief = buildReportBrief({
    spec: context.spec,
    attemptSummary: summary
  });
  const styleId = inferStyleIdFromBrief(brief);
  const model = resolveModel();

  const reportJson = await generateLlmReport({
    brief,
    styleId,
    model
  });

  const generated = await upsertReportArtifact({
    purchase_id: context.purchase_id,
    tenant_id: context.tenant_id,
    test_id: context.test_id,
    session_id: context.session_id,
    locale: context.locale,
    style_id: styleId,
    model,
    prompt_version: PROMPT_VERSION,
    scoring_version: SCORING_VERSION,
    report_json: reportJson
  });

  await markJobReady(context.purchase_id);

  return {
    kind: "ready",
    generated: toGeneratedPayload(generated)
  };
};

const respondWithGenerated = async (context: AccessContext): Promise<Response> => {
  const generatedResolution = await resolveGeneratedContent(context);

  if (generatedResolution.kind === "generating") {
    return withCreditsCookie(
      NextResponse.json({ status: "generating" }, { status: 202 }),
      context.credits_state
    );
  }

  if (generatedResolution.kind === "blocked") {
    return withCreditsCookie(
      NextResponse.json({ error: generatedResolution.error }, { status: 409 }),
      context.credits_state
    );
  }

  return buildReadyResponse(
    withGeneratedPayload(context.payload, generatedResolution.generated),
    context.credits_state
  );
};

export const POST = withApiGuards(async (request: Request): Promise<Response> => {
  let body: Record<string, unknown> | null = null;
  try {
    body = requireRecord(await request.json());
  } catch {
    body = null;
  }

  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const slug = requireString(body.slug);
  if (!slug) {
    return NextResponse.json({ error: "slug is required." }, { status: 400 });
  }

  const context = await resolveTenantContext();
  const published = await loadPublishedTestBySlug(context.tenantId, slug, context.locale);
  if (!published) {
    return NextResponse.json({ error: "Test not available." }, { status: 404 });
  }
  const testId = published.test_id;

  const url = new URL(request.url);
  const reportLinkTokenValue =
    requireString(body.report_link_token) ?? requireString(url.searchParams.get("t"));
  let reportLinkPayload: ReturnType<typeof verifyReportLinkToken> | null = null;
  if (reportLinkTokenValue) {
    try {
      reportLinkPayload = verifyReportLinkToken(reportLinkTokenValue);
    } catch {
      reportLinkPayload = null;
    }
  }

  const cookieRecord = parseCookies(request.headers.get("cookie"));
  const reportTokenValue = cookieRecord[REPORT_TOKEN] ?? null;
  const resultCookieValue = cookieRecord[RESULT_COOKIE] ?? null;
  const reportPayload = reportTokenValue ? verifyReportToken(reportTokenValue) : null;
  const resultPayload = resultCookieValue ? verifyResultCookie(resultCookieValue) : null;

  if (reportLinkTokenValue) {
    if (!reportLinkPayload) {
      return NextResponse.json({ error: "Report access is invalid." }, { status: 403 });
    }

    if (
      reportLinkPayload.tenant_id !== context.tenantId ||
      reportLinkPayload.test_id !== testId
    ) {
      return NextResponse.json({ error: "Report access is invalid." }, { status: 403 });
    }

    const reportKey = createReportKey(
      context.tenantId,
      testId,
      reportLinkPayload.session_id
    );
    if (reportKey !== reportLinkPayload.report_key) {
      return NextResponse.json({ error: "Report access is invalid." }, { status: 403 });
    }

    const reportTest = await loadPublishedTestBySlug(
      context.tenantId,
      slug,
      reportLinkPayload.locale
    );
    if (!reportTest) {
      return NextResponse.json({ error: "Report content unavailable." }, { status: 404 });
    }

    const report = buildReportPayload(
      reportTest.test,
      reportLinkPayload.band_id,
      reportLinkPayload.scale_scores
    );
    if (!report) {
      return NextResponse.json({ error: "Report content unavailable." }, { status: 404 });
    }

    const creditsState = parseCreditsCookie(cookieRecord, context.tenantId);

    return respondWithGenerated({
      purchase_id: reportLinkPayload.purchase_id,
      tenant_id: context.tenantId,
      test_id: testId,
      session_id: reportLinkPayload.session_id,
      locale: reportTest.locale,
      spec: reportTest.spec,
      payload: {
        ok: true,
        report,
        purchase_id: reportLinkPayload.purchase_id,
        session_id: reportLinkPayload.session_id,
        credits_balance_after: creditsState.credits_remaining,
        consumed_credit: false
      },
      credits_state: null
    });
  }

  const hasCookiePayloads = Boolean(reportPayload && resultPayload);
  const matchesContext =
    reportPayload &&
    resultPayload &&
    reportPayload.tenant_id === context.tenantId &&
    reportPayload.test_id === testId &&
    resultPayload.tenant_id === reportPayload.tenant_id &&
    resultPayload.test_id === reportPayload.test_id &&
    resultPayload.session_id === reportPayload.session_id &&
    resultPayload.distinct_id === reportPayload.distinct_id;

  if (matchesContext && reportPayload && resultPayload) {
    const reportKey = createReportKey(
      context.tenantId,
      testId,
      reportPayload.session_id
    );
    const creditsState = parseCreditsCookie(cookieRecord, context.tenantId);
    const alreadyConsumed = creditsState.consumed_report_keys.includes(reportKey);

    let nextCreditsState = creditsState;
    let consumedCredit = false;

    if (!alreadyConsumed) {
      const consumeResult = consumeCreditForReport(creditsState, reportKey);
      if (!consumeResult.consumed) {
        return NextResponse.json(
          {
            error: "Insufficient credits.",
            paywall_url: `/t/${slug}/pay`
          },
          { status: 402 }
        );
      }

      nextCreditsState = consumeResult.new_state;
      consumedCredit = true;
    }

    const report = buildReportPayload(
      published.test,
      resultPayload.band_id,
      resultPayload.scale_scores
    );
    if (!report) {
      return NextResponse.json({ error: "Report content unavailable." }, { status: 404 });
    }

    return respondWithGenerated({
      purchase_id: reportPayload.purchase_id,
      tenant_id: context.tenantId,
      test_id: testId,
      session_id: reportPayload.session_id,
      locale: published.locale,
      spec: published.spec,
      payload: {
        ok: true,
        report,
        purchase_id: reportPayload.purchase_id,
        session_id: reportPayload.session_id,
        credits_balance_after: nextCreditsState.credits_remaining,
        consumed_credit: consumedCredit
      },
      credits_state: nextCreditsState
    });
  }

  if (!hasCookiePayloads) {
    return NextResponse.json({ error: "Report is locked." }, { status: 401 });
  }

  return NextResponse.json({ error: "Report access is invalid." }, { status: 403 });
}, { methods: ["POST"] });

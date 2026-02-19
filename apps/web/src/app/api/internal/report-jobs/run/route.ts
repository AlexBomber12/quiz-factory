import { NextResponse } from "next/server";

import { loadPublishedTestById } from "@/lib/content/provider";
import { generateLlmReport } from "@/lib/report/llm_report_generator";
import { PROMPT_VERSION } from "@/lib/report/llm_report_schema";
import { buildReportBrief, SCORING_VERSION } from "@/lib/report/report_brief";
import { hasReportArtifact, insertReportArtifact } from "@/lib/report/report_artifact_repo";
import { getAttemptSummary } from "@/lib/report/attempt_summary_repo";
import { parseReportJobClaimLimit } from "@/lib/report/report_job_inputs";
import { claimQueuedJobs, markJobFailed, markJobReady } from "@/lib/report/report_job_repo";
import { inferStyleIdFromBrief } from "@/lib/report/style_inference";
import { normalizeString } from "@/lib/utils/strings";

const DEFAULT_OPENAI_MODEL = "gpt-4o";
const OPENAI_NOT_CONFIGURED_ERROR = "openai not configured";
const MAX_ERROR_LENGTH = 160;


const resolveModel = (): string => normalizeString(process.env.OPENAI_MODEL) ?? DEFAULT_OPENAI_MODEL;

const hasOpenAiApiKey = (): boolean => Boolean(normalizeString(process.env.OPENAI_API_KEY));

const toShortError = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return "report generation failed";
  }

  const message = normalizeString(error.message) ?? "report generation failed";
  return message.slice(0, MAX_ERROR_LENGTH);
};

const isAuthorizedWorker = (request: Request): boolean => {
  const expectedSecret = process.env.REPORT_WORKER_SECRET?.trim() ?? "";
  const providedSecret = request.headers.get("x-worker-secret")?.trim() ?? "";

  return expectedSecret.length > 0 && providedSecret === expectedSecret;
};

export const POST = async (request: Request): Promise<Response> => {
  if (!isAuthorizedWorker(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const limitParam = new URL(request.url).searchParams.get("limit");
  const limit = parseReportJobClaimLimit(limitParam);
  const claimedJobs = await claimQueuedJobs(limit);
  const openAiConfigured = hasOpenAiApiKey();
  const model = resolveModel();

  let failed = 0;
  let ready = 0;

  for (const job of claimedJobs) {
    try {
      if (await hasReportArtifact(job.purchase_id)) {
        await markJobReady(job.purchase_id);
        ready += 1;
        continue;
      }

      if (!openAiConfigured) {
        await markJobFailed(job.purchase_id, OPENAI_NOT_CONFIGURED_ERROR);
        failed += 1;
        continue;
      }

      const summary = await getAttemptSummary(job.tenant_id, job.test_id, job.session_id);
      if (!summary) {
        await markJobFailed(job.purchase_id, "attempt summary missing");
        failed += 1;
        continue;
      }

      const publishedTest = await loadPublishedTestById(job.tenant_id, job.test_id, job.locale);
      if (!publishedTest) {
        await markJobFailed(job.purchase_id, "published test missing");
        failed += 1;
        continue;
      }

      const brief = buildReportBrief({
        spec: publishedTest.spec,
        attemptSummary: summary
      });
      const styleId = inferStyleIdFromBrief(brief);

      const reportJson = await generateLlmReport({
        brief,
        styleId,
        model
      });

      await insertReportArtifact({
        purchase_id: job.purchase_id,
        tenant_id: job.tenant_id,
        test_id: job.test_id,
        session_id: job.session_id,
        locale: job.locale,
        style_id: styleId,
        model,
        prompt_version: PROMPT_VERSION,
        scoring_version: SCORING_VERSION,
        report_json: reportJson
      });

      await markJobReady(job.purchase_id);
      ready += 1;
    } catch (error) {
      await markJobFailed(job.purchase_id, toShortError(error));
      failed += 1;
    }
  }

  return NextResponse.json({
    claimed: claimedJobs.length,
    failed,
    ready
  });
};

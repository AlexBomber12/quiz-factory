import { NextResponse } from "next/server";

import { getAttemptSummary } from "../../../../../lib/report/attempt_summary_repo";
import { parseReportJobClaimLimit } from "../../../../../lib/report/report_job_inputs";
import { claimQueuedJobs, markJobFailed } from "../../../../../lib/report/report_job_repo";

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

  let failed = 0;
  const ready = 0;

  for (const job of claimedJobs) {
    const summary = await getAttemptSummary(job.tenant_id, job.test_id, job.session_id);
    if (!summary) {
      await markJobFailed(job.purchase_id, "attempt summary missing");
      failed += 1;
      continue;
    }

    await markJobFailed(job.purchase_id, "report generator not implemented");
    failed += 1;
  }

  return NextResponse.json({
    claimed: claimedJobs.length,
    failed,
    ready
  });
};

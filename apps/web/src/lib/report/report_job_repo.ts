import { getContentDbPool } from "../content_db/pool";

import {
  parseReportJobClaimLimit,
  sanitizeEnqueueReportJobInput,
  type EnqueueReportJobInput
} from "./report_job_inputs";

type TimestampValue = Date | string | null;

export type ReportJobStatus = "queued" | "running" | "ready" | "failed";

type ReportJobRow = {
  id: string;
  purchase_id: string;
  tenant_id: string;
  test_id: string;
  session_id: string;
  locale: string;
  status: ReportJobStatus;
  attempts: number;
  last_error: string | null;
  created_at: TimestampValue;
  updated_at: TimestampValue;
  started_at: TimestampValue;
  completed_at: TimestampValue;
};

export type ReportJobRecord = {
  id: string;
  purchase_id: string;
  tenant_id: string;
  test_id: string;
  session_id: string;
  locale: string;
  status: ReportJobStatus;
  attempts: number;
  last_error: string | null;
  created_at: string | null;
  updated_at: string | null;
  started_at: string | null;
  completed_at: string | null;
};

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toIsoString = (value: TimestampValue): string | null => {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
};

const mapRowToRecord = (row: ReportJobRow): ReportJobRecord => ({
  id: row.id,
  purchase_id: row.purchase_id,
  tenant_id: row.tenant_id,
  test_id: row.test_id,
  session_id: row.session_id,
  locale: row.locale,
  status: row.status,
  attempts: row.attempts,
  last_error: row.last_error,
  created_at: toIsoString(row.created_at),
  updated_at: toIsoString(row.updated_at),
  started_at: toIsoString(row.started_at),
  completed_at: toIsoString(row.completed_at)
});

const parseClaimLimit = (limit: number): number => {
  return parseReportJobClaimLimit(String(limit));
};

export const enqueueReportJob = async (
  input: EnqueueReportJobInput
): Promise<ReportJobRecord | null> => {
  const normalized = sanitizeEnqueueReportJobInput(input);
  if (!normalized) {
    throw new Error("Invalid report job input.");
  }

  const pool = getContentDbPool();
  const { rows } = await pool.query<ReportJobRow>(
    `
      INSERT INTO report_jobs (
        purchase_id,
        tenant_id,
        test_id,
        session_id,
        locale,
        status
      )
      VALUES ($1, $2, $3, $4, $5, 'queued')
      ON CONFLICT (purchase_id) DO NOTHING
      RETURNING
        id,
        purchase_id,
        tenant_id,
        test_id,
        session_id,
        locale,
        status,
        attempts,
        last_error,
        created_at,
        updated_at,
        started_at,
        completed_at
    `,
    [
      normalized.purchase_id,
      normalized.tenant_id,
      normalized.test_id,
      normalized.session_id,
      normalized.locale
    ]
  );

  const row = rows[0];
  return row ? mapRowToRecord(row) : null;
};

export const getReportJobByPurchaseId = async (
  purchaseId: string
): Promise<ReportJobRecord | null> => {
  const normalizedPurchaseId = normalizeString(purchaseId);
  if (!normalizedPurchaseId) {
    return null;
  }

  const pool = getContentDbPool();
  const { rows } = await pool.query<ReportJobRow>(
    `
      SELECT
        id,
        purchase_id,
        tenant_id,
        test_id,
        session_id,
        locale,
        status,
        attempts,
        last_error,
        created_at,
        updated_at,
        started_at,
        completed_at
      FROM report_jobs
      WHERE purchase_id = $1
      LIMIT 1
    `,
    [normalizedPurchaseId]
  );

  const row = rows[0];
  return row ? mapRowToRecord(row) : null;
};

export const claimQueuedJobs = async (limit: number): Promise<ReportJobRecord[]> => {
  const normalizedLimit = parseClaimLimit(limit);
  const pool = getContentDbPool();
  const { rows } = await pool.query<ReportJobRow>(
    `
      WITH claimed AS (
        SELECT id
        FROM report_jobs
        WHERE status = 'queued'
        ORDER BY created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE report_jobs jobs
      SET
        status = 'running',
        started_at = COALESCE(jobs.started_at, now()),
        updated_at = now()
      FROM claimed
      WHERE jobs.id = claimed.id
      RETURNING
        jobs.id,
        jobs.purchase_id,
        jobs.tenant_id,
        jobs.test_id,
        jobs.session_id,
        jobs.locale,
        jobs.status,
        jobs.attempts,
        jobs.last_error,
        jobs.created_at,
        jobs.updated_at,
        jobs.started_at,
        jobs.completed_at
    `,
    [normalizedLimit]
  );

  return rows.map((row) => mapRowToRecord(row));
};

export const markJobFailed = async (
  purchaseId: string,
  error: string
): Promise<ReportJobRecord | null> => {
  const normalizedPurchaseId = normalizeString(purchaseId);
  const normalizedError = normalizeString(error);
  if (!normalizedPurchaseId || !normalizedError) {
    return null;
  }

  const pool = getContentDbPool();
  const { rows } = await pool.query<ReportJobRow>(
    `
      UPDATE report_jobs
      SET
        status = 'failed',
        attempts = attempts + 1,
        last_error = $2,
        updated_at = now(),
        completed_at = NULL
      WHERE purchase_id = $1
      RETURNING
        id,
        purchase_id,
        tenant_id,
        test_id,
        session_id,
        locale,
        status,
        attempts,
        last_error,
        created_at,
        updated_at,
        started_at,
        completed_at
    `,
    [normalizedPurchaseId, normalizedError]
  );

  const row = rows[0];
  return row ? mapRowToRecord(row) : null;
};

export const markJobReady = async (purchaseId: string): Promise<ReportJobRecord | null> => {
  const normalizedPurchaseId = normalizeString(purchaseId);
  if (!normalizedPurchaseId) {
    return null;
  }

  const pool = getContentDbPool();
  const { rows } = await pool.query<ReportJobRow>(
    `
      UPDATE report_jobs
      SET
        status = 'ready',
        last_error = NULL,
        updated_at = now(),
        completed_at = now()
      WHERE purchase_id = $1
      RETURNING
        id,
        purchase_id,
        tenant_id,
        test_id,
        session_id,
        locale,
        status,
        attempts,
        last_error,
        created_at,
        updated_at,
        started_at,
        completed_at
    `,
    [normalizedPurchaseId]
  );

  const row = rows[0];
  return row ? mapRowToRecord(row) : null;
};

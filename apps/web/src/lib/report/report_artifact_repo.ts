import { getContentDbPool } from "../content_db/pool";

type ReportArtifactInput = {
  purchase_id: string;
  tenant_id: string;
  test_id: string;
  session_id: string;
  locale: string;
  style_id: string;
  model: string;
  prompt_version: string;
  scoring_version: string;
  report_json: unknown;
};

type ReportArtifactIdentity = {
  tenant_id: string;
  test_id: string;
  session_id: string;
};

type TimestampValue = Date | string | null;

type ReportArtifactRow = {
  purchase_id: string;
  tenant_id: string;
  test_id: string;
  session_id: string;
  locale: string;
  style_id: string;
  model: string;
  prompt_version: string;
  scoring_version: string;
  report_json: unknown;
  created_at: TimestampValue;
};

export type ReportArtifactRecord = {
  purchase_id: string;
  tenant_id: string;
  test_id: string;
  session_id: string;
  locale: string;
  style_id: string;
  model: string;
  prompt_version: string;
  scoring_version: string;
  report_json: unknown;
  created_at: string | null;
};

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const requireString = (value: unknown, fieldName: string): string => {
  const normalized = normalizeString(value);
  if (!normalized) {
    throw new Error(`Invalid ${fieldName}.`);
  }

  return normalized;
};

const normalizeIdentity = (identity: ReportArtifactIdentity): ReportArtifactIdentity | null => {
  const tenantId = normalizeString(identity.tenant_id);
  const testId = normalizeString(identity.test_id);
  const sessionId = normalizeString(identity.session_id);
  if (!tenantId || !testId || !sessionId) {
    return null;
  }

  return {
    tenant_id: tenantId,
    test_id: testId,
    session_id: sessionId
  };
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

const mapArtifactRow = (row: ReportArtifactRow): ReportArtifactRecord => {
  return {
    purchase_id: row.purchase_id,
    tenant_id: row.tenant_id,
    test_id: row.test_id,
    session_id: row.session_id,
    locale: row.locale,
    style_id: row.style_id,
    model: row.model,
    prompt_version: row.prompt_version,
    scoring_version: row.scoring_version,
    report_json: row.report_json,
    created_at: toIsoString(row.created_at)
  };
};

const sanitizeArtifactInput = (input: ReportArtifactInput) => {
  return {
    purchase_id: requireString(input.purchase_id, "purchase_id"),
    tenant_id: requireString(input.tenant_id, "tenant_id"),
    test_id: requireString(input.test_id, "test_id"),
    session_id: requireString(input.session_id, "session_id"),
    locale: requireString(input.locale, "locale"),
    style_id: requireString(input.style_id, "style_id"),
    model: requireString(input.model, "model"),
    prompt_version: requireString(input.prompt_version, "prompt_version"),
    scoring_version: requireString(input.scoring_version, "scoring_version")
  };
};

export const getReportArtifactByPurchaseId = async (
  purchaseId: string,
  identity: ReportArtifactIdentity
): Promise<ReportArtifactRecord | null> => {
  const normalizedPurchaseId = normalizeString(purchaseId);
  const normalizedIdentity = normalizeIdentity(identity);
  if (!normalizedPurchaseId || !normalizedIdentity) {
    return null;
  }

  const pool = getContentDbPool();
  const { rows } = await pool.query<ReportArtifactRow>(
    `
      SELECT
        purchase_id,
        tenant_id,
        test_id,
        session_id,
        locale,
        style_id,
        model,
        prompt_version,
        scoring_version,
        report_json,
        created_at
      FROM report_artifacts
      WHERE purchase_id = $1
        AND tenant_id = $2
        AND test_id = $3
        AND session_id = $4
      LIMIT 1
    `,
    [
      normalizedPurchaseId,
      normalizedIdentity.tenant_id,
      normalizedIdentity.test_id,
      normalizedIdentity.session_id
    ]
  );

  const row = rows[0];
  return row ? mapArtifactRow(row) : null;
};

export const upsertReportArtifact = async (
  input: ReportArtifactInput
): Promise<ReportArtifactRecord> => {
  const normalized = sanitizeArtifactInput(input);
  const reportJson = JSON.stringify(input.report_json);
  if (typeof reportJson !== "string") {
    throw new Error("Invalid report_json.");
  }

  const pool = getContentDbPool();
  const { rows } = await pool.query<ReportArtifactRow>(
    `
      INSERT INTO report_artifacts (
        purchase_id,
        tenant_id,
        test_id,
        session_id,
        locale,
        style_id,
        model,
        prompt_version,
        scoring_version,
        report_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
      ON CONFLICT (purchase_id)
      DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        test_id = EXCLUDED.test_id,
        session_id = EXCLUDED.session_id,
        locale = EXCLUDED.locale,
        style_id = EXCLUDED.style_id,
        model = EXCLUDED.model,
        prompt_version = EXCLUDED.prompt_version,
        scoring_version = EXCLUDED.scoring_version,
        report_json = EXCLUDED.report_json
      RETURNING
        purchase_id,
        tenant_id,
        test_id,
        session_id,
        locale,
        style_id,
        model,
        prompt_version,
        scoring_version,
        report_json,
        created_at
    `,
    [
      normalized.purchase_id,
      normalized.tenant_id,
      normalized.test_id,
      normalized.session_id,
      normalized.locale,
      normalized.style_id,
      normalized.model,
      normalized.prompt_version,
      normalized.scoring_version,
      reportJson
    ]
  );

  const row = rows[0];
  if (!row) {
    throw new Error("Failed to upsert report artifact.");
  }

  return mapArtifactRow(row);
};

export const hasReportArtifact = async (purchaseId: string): Promise<boolean> => {
  const normalizedPurchaseId = normalizeString(purchaseId);
  if (!normalizedPurchaseId) {
    return false;
  }

  const pool = getContentDbPool();
  const { rowCount } = await pool.query(
    `
      SELECT 1
      FROM report_artifacts
      WHERE purchase_id = $1
      LIMIT 1
    `,
    [normalizedPurchaseId]
  );

  return (rowCount ?? 0) > 0;
};

export const insertReportArtifact = async (input: ReportArtifactInput): Promise<boolean> => {
  const normalized = sanitizeArtifactInput(input);

  const reportJson = JSON.stringify(input.report_json);
  if (typeof reportJson !== "string") {
    throw new Error("Invalid report_json.");
  }

  const pool = getContentDbPool();
  const { rowCount } = await pool.query(
    `
      INSERT INTO report_artifacts (
        purchase_id,
        tenant_id,
        test_id,
        session_id,
        locale,
        style_id,
        model,
        prompt_version,
        scoring_version,
        report_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
      ON CONFLICT (purchase_id) DO NOTHING
    `,
    [
      normalized.purchase_id,
      normalized.tenant_id,
      normalized.test_id,
      normalized.session_id,
      normalized.locale,
      normalized.style_id,
      normalized.model,
      normalized.prompt_version,
      normalized.scoring_version,
      reportJson
    ]
  );

  return (rowCount ?? 0) > 0;
};

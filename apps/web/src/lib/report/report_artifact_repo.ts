import { getContentDbPool } from "../content_db/pool";

type InsertReportArtifactInput = {
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

export const insertReportArtifact = async (input: InsertReportArtifactInput): Promise<boolean> => {
  const normalized = {
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

  const reportJson = JSON.stringify(input.report_json);
  if (!reportJson) {
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

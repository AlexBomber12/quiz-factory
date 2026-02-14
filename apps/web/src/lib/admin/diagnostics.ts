import { getContentDbPool, hasContentDatabaseUrl } from "../content_db/pool";
import { resolveContentSource, type ContentSource } from "../content/provider";
import { listTenantRegistry } from "./publish";

type AppliedMigrationsTableRow = {
  table_exists: boolean;
};

type AppliedMigrationsRowsRow = {
  has_rows: boolean;
};

export type AdminDiagnostics = {
  nodeEnv: string;
  commitSha: string | null;
  contentSource: ContentSource;
  contentDatabaseUrlConfigured: boolean;
  tenantRegistryCount: number;
  contentDbMigrationsApplied: boolean;
  criticalWarnings: string[];
  publishActionsEnabled: boolean;
  publishActionsDisabledReason: string | null;
};

const normalizeEnvString = (value: string | undefined): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readAppliedMigrationsState = async (): Promise<boolean> => {
  if (!hasContentDatabaseUrl()) {
    return false;
  }

  try {
    const pool = getContentDbPool();
    const tableExistsResult = await pool.query<AppliedMigrationsTableRow>(
      "SELECT to_regclass('applied_migrations') IS NOT NULL AS table_exists"
    );
    if (!tableExistsResult.rows[0]?.table_exists) {
      return false;
    }

    const hasRowsResult = await pool.query<AppliedMigrationsRowsRow>(
      "SELECT EXISTS (SELECT 1 FROM applied_migrations LIMIT 1) AS has_rows"
    );
    return hasRowsResult.rows[0]?.has_rows ?? false;
  } catch {
    return false;
  }
};

export const readAdminDiagnostics = async (): Promise<AdminDiagnostics> => {
  const nodeEnv = normalizeEnvString(process.env.NODE_ENV) ?? "unknown";
  const commitSha = normalizeEnvString(process.env.COMMIT_SHA);
  const contentSource = resolveContentSource();
  const contentDatabaseUrlConfigured = hasContentDatabaseUrl();
  const tenantRegistryCount = listTenantRegistry().length;
  const contentDbMigrationsApplied = await readAppliedMigrationsState();

  const criticalWarnings: string[] = [];
  if (contentSource !== "db") {
    criticalWarnings.push("CONTENT_SOURCE resolves to fs. Set CONTENT_SOURCE=db.");
  }
  if (!contentDatabaseUrlConfigured) {
    criticalWarnings.push("CONTENT_DATABASE_URL is not configured.");
  }
  if (tenantRegistryCount === 0) {
    criticalWarnings.push("No tenants were loaded from config/tenants.json.");
  }
  if (!contentDbMigrationsApplied) {
    criticalWarnings.push(
      "Content DB migrations are not applied (applied_migrations table is missing or empty)."
    );
  }

  const publishActionsEnabled = contentSource === "db" && contentDatabaseUrlConfigured;
  const publishActionsDisabledReason = publishActionsEnabled
    ? null
    : "Publish and rollback are disabled. Set CONTENT_SOURCE=db and configure CONTENT_DATABASE_URL.";

  return {
    nodeEnv,
    commitSha,
    contentSource,
    contentDatabaseUrlConfigured,
    tenantRegistryCount,
    contentDbMigrationsApplied,
    criticalWarnings,
    publishActionsEnabled,
    publishActionsDisabledReason
  };
};

import { validateTestSpec } from "../content/validate";
import { getContentDbPool } from "../content_db/pool";
import { listTenantRegistry } from "./publish";

type VersionSpecRow = {
  test_id: string;
  spec_json: unknown;
};

type PublishGuardrailInput = {
  test_id: string;
  version_id: string;
  tenant_ids: string[];
};

type RollbackGuardrailInput = {
  test_id: string;
  version_id: string;
  tenant_id: string;
};

export class PublishGuardrailValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublishGuardrailValidationError";
  }
}

export const isPublishGuardrailValidationError = (
  error: unknown
): error is PublishGuardrailValidationError => {
  return error instanceof Error && error.name === "PublishGuardrailValidationError";
};

const listUnknownTenantIds = (tenantIds: string[]): string[] => {
  const knownTenantIds = new Set(listTenantRegistry().map((entry) => entry.tenant_id));
  return tenantIds.filter((tenantId) => !knownTenantIds.has(tenantId));
};

const resolveVersionSpec = async (
  testId: string,
  versionId: string
): Promise<VersionSpecRow | null> => {
  const pool = getContentDbPool();
  const { rows } = await pool.query<VersionSpecRow>(
    `
      SELECT
        t.test_id,
        tv.spec_json
      FROM tests t
      JOIN test_versions tv
        ON tv.test_id = t.id
      WHERE t.test_id = $1
        AND tv.id = $2
      LIMIT 1
    `,
    [testId, versionId]
  );

  return rows[0] ?? null;
};

const validateVersionSpecForPublish = (testId: string, specJson: unknown): void => {
  let spec: ReturnType<typeof validateTestSpec>;
  try {
    spec = validateTestSpec(specJson, testId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid version spec_json.";
    throw new PublishGuardrailValidationError(message);
  }

  if (!spec.locales.en) {
    throw new PublishGuardrailValidationError(
      `version_id is invalid for publish: spec_json for test_id '${testId}' must include locales.en.`
    );
  }
};

export const validatePublishGuardrails = async (input: PublishGuardrailInput): Promise<void> => {
  const unknownTenantIds = listUnknownTenantIds(input.tenant_ids);
  if (unknownTenantIds.length > 0) {
    throw new PublishGuardrailValidationError(
      `Unknown tenant_id values in config/tenants.json: ${unknownTenantIds.join(", ")}.`
    );
  }

  const versionSpec = await resolveVersionSpec(input.test_id, input.version_id);
  if (!versionSpec) {
    throw new PublishGuardrailValidationError(
      `version_id '${input.version_id}' does not belong to test_id '${input.test_id}'.`
    );
  }

  validateVersionSpecForPublish(input.test_id, versionSpec.spec_json);
};

export const validateRollbackGuardrails = async (input: RollbackGuardrailInput): Promise<void> => {
  const unknownTenantIds = listUnknownTenantIds([input.tenant_id]);
  if (unknownTenantIds.length > 0) {
    throw new PublishGuardrailValidationError(
      `Unknown tenant_id '${input.tenant_id}' in config/tenants.json.`
    );
  }

  const versionSpec = await resolveVersionSpec(input.test_id, input.version_id);
  if (!versionSpec) {
    throw new PublishGuardrailValidationError(
      `version_id '${input.version_id}' does not belong to test_id '${input.test_id}'.`
    );
  }
};

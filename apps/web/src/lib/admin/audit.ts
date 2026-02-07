import { getContentDbPool } from "../content_db/pool";

import { type AdminRole, isAdminRole } from "./session";

export type LogAdminEventInput = {
  actorRole: AdminRole;
  actorHint?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  meta?: Record<string, unknown> | null;
};

const normalizeNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const requireNonEmptyString = (value: unknown, fieldName: string): string => {
  const normalized = normalizeNonEmptyString(value);
  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }

  return normalized;
};

const normalizeMeta = (value: unknown): Record<string, unknown> => {
  if (!value) {
    return {};
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("meta must be an object when provided.");
  }

  return value as Record<string, unknown>;
};

export const logAdminEvent = async (input: LogAdminEventInput): Promise<void> => {
  if (!isAdminRole(input.actorRole)) {
    throw new Error("actorRole must be admin or editor.");
  }

  const actorHint = normalizeNonEmptyString(input.actorHint ?? null);
  const action = requireNonEmptyString(input.action, "action");
  const targetType = requireNonEmptyString(input.targetType, "targetType");
  const targetId = requireNonEmptyString(input.targetId, "targetId");
  const meta = normalizeMeta(input.meta);

  const pool = getContentDbPool();
  await pool.query(
    `
      INSERT INTO admin_audit_events (
        actor_role,
        actor_hint,
        action,
        target_type,
        target_id,
        meta_json
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    `,
    [input.actorRole, actorHint, action, targetType, targetId, JSON.stringify(meta)]
  );
};

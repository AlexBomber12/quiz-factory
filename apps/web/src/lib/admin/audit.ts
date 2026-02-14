import { getContentDbPool } from "../content_db/pool";

import { type AdminRole, isAdminRole } from "./session";

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;
const MAX_METADATA_BYTES = 2_048;

export type AdminAuditEventRecord = {
  occurred_at: string;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
};

export type ListAdminAuditEventsInput = {
  q?: string | null;
  action?: string | null;
  limit?: number;
  offset?: number;
};

export type LogAdminEventInput = {
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata?: Record<string, unknown> | null;
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

const clampLimit = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_LIST_LIMIT;
  }

  const normalized = Math.floor(value);
  if (normalized < 1) {
    return DEFAULT_LIST_LIMIT;
  }

  return Math.min(normalized, MAX_LIST_LIMIT);
};

const clampOffset = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  const normalized = Math.floor(value);
  return normalized >= 0 ? normalized : 0;
};

const parseActor = (value: string): { role: AdminRole; hint: string | null } => {
  const normalized = requireNonEmptyString(value, "actor");
  const [roleToken, ...rest] = normalized.split(":");
  const roleCandidate = normalizeNonEmptyString(roleToken);

  if (!roleCandidate || !isAdminRole(roleCandidate)) {
    throw new Error("actor must start with admin or editor.");
  }

  const actorHint =
    rest.length > 0 ? normalizeNonEmptyString(rest.join(":")) : null;

  return {
    role: roleCandidate,
    hint: actorHint
  };
};

const truncateMeta = (meta: Record<string, unknown>): Record<string, unknown> => {
  const serialized = JSON.stringify(meta);
  const size = Buffer.byteLength(serialized, "utf8");
  if (size <= MAX_METADATA_BYTES) {
    return meta;
  }

  return {
    truncated: true,
    original_size_bytes: size
  };
};

const parseMetadata = (value: unknown): Record<string, unknown> => {
  const normalized = normalizeMeta(value);
  return truncateMeta(normalized);
};

const toIsoString = (value: Date | string): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
};

type AdminAuditEventRow = {
  occurred_at: Date | string;
  actor_role: AdminRole;
  actor_hint: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata_json: Record<string, unknown> | null;
};

export const listAdminAuditEvents = async (
  input: ListAdminAuditEventsInput = {}
): Promise<AdminAuditEventRecord[]> => {
  const q = normalizeNonEmptyString(input.q ?? null);
  const action = normalizeNonEmptyString(input.action ?? null);
  const limit = clampLimit(input.limit);
  const offset = clampOffset(input.offset);
  const filters: string[] = [];
  const values: unknown[] = [];

  if (q) {
    values.push(`%${q}%`);
    const index = values.length;
    filters.push(
      `(target_id ILIKE $${index} OR action ILIKE $${index} OR actor_role ILIKE $${index} OR COALESCE(actor_hint, '') ILIKE $${index})`
    );
  }

  if (action) {
    values.push(action);
    filters.push(`action = $${values.length}`);
  }

  values.push(limit);
  const limitIndex = values.length;
  values.push(offset);
  const offsetIndex = values.length;

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
  const pool = getContentDbPool();
  const { rows } = await pool.query<AdminAuditEventRow>(
    `
      SELECT
        at AS occurred_at,
        actor_role,
        actor_hint,
        action,
        target_type AS entity_type,
        target_id AS entity_id,
        meta_json AS metadata_json
      FROM admin_audit_events
      ${whereClause}
      ORDER BY at DESC
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex}
    `,
    values
  );

  return rows.map((row) => ({
    occurred_at: toIsoString(row.occurred_at),
    actor: row.actor_hint ?? row.actor_role,
    action: row.action,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    metadata: normalizeMeta(row.metadata_json)
  }));
};

export const logAdminEvent = async (input: LogAdminEventInput): Promise<void> => {
  const actor = parseActor(input.actor);
  const action = requireNonEmptyString(input.action, "action");
  const entityType = requireNonEmptyString(input.entity_type, "entity_type");
  const entityId = requireNonEmptyString(input.entity_id, "entity_id");
  const metadata = parseMetadata(input.metadata ?? null);

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
    [actor.role, actor.hint, action, entityType, entityId, JSON.stringify(metadata)]
  );
};

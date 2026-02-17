import { getContentDbPool } from "../content_db/pool";

import {
  ALERT_INSTANCE_SEVERITIES,
  ALERT_INSTANCE_STATUSES,
  ALERT_RULE_TYPES,
  type AlertInstanceRecord,
  type AlertInstanceSeverity,
  type AlertInstanceStatus,
  type AlertRuleParams,
  type AlertRuleRecord,
  type AlertRuleScope,
  type AlertRuleType,
  type CreateAlertRuleInput,
  type ListAlertInstancesInput,
  type ListAlertRulesInput,
  type UpdateAlertRuleInput
} from "./types";

type TimestampValue = Date | string;

type AlertRuleRow = {
  id: string;
  name: string;
  enabled: boolean;
  rule_type: string;
  scope_json: unknown;
  params_json: unknown;
  created_at: TimestampValue;
  updated_at: TimestampValue;
};

type AlertInstanceRow = {
  id: string;
  rule_id: string;
  rule_name: string;
  rule_type: string;
  status: string;
  severity: string;
  fired_at: TimestampValue;
  context_json: unknown;
  fingerprint: string;
  created_at: TimestampValue;
};

type UpdatedAlertInstanceRow = {
  id: string;
  rule_id: string;
  status: string;
};

type InsertAlertInstanceInput = {
  rule_id: string;
  status?: AlertInstanceStatus;
  severity: AlertInstanceSeverity;
  fired_at: string;
  context_json: Record<string, unknown>;
  fingerprint: string;
};

type InsertAlertInstanceResult = {
  inserted: boolean;
  id: string | null;
};

const RULE_TYPE_SET = new Set<string>(ALERT_RULE_TYPES);
const STATUS_SET = new Set<string>(ALERT_INSTANCE_STATUSES);
const SEVERITY_SET = new Set<string>(ALERT_INSTANCE_SEVERITIES);

const DEFAULT_INSTANCES_LIMIT = 100;
const MAX_INSTANCES_LIMIT = 500;

const normalizeNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toIsoString = (value: TimestampValue): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
};

const normalizeRuleType = (value: unknown): AlertRuleType => {
  const normalized = normalizeNonEmptyString(value)?.toLowerCase();
  if (!normalized || !RULE_TYPE_SET.has(normalized)) {
    throw new Error("rule_type is invalid.");
  }

  return normalized as AlertRuleType;
};

const normalizeStatus = (value: unknown): AlertInstanceStatus => {
  const normalized = normalizeNonEmptyString(value)?.toLowerCase();
  if (!normalized || !STATUS_SET.has(normalized)) {
    throw new Error("status is invalid.");
  }

  return normalized as AlertInstanceStatus;
};

const normalizeSeverity = (value: unknown): AlertInstanceSeverity => {
  const normalized = normalizeNonEmptyString(value)?.toLowerCase();
  if (!normalized || !SEVERITY_SET.has(normalized)) {
    throw new Error("severity is invalid.");
  }

  return normalized as AlertInstanceSeverity;
};

const normalizeObjectRecord = (
  value: unknown,
  fieldName: string
): Record<string, unknown> => {
  if (value === null || value === undefined) {
    return {};
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object.`);
  }

  return value as Record<string, unknown>;
};

const normalizeAlertScope = (value: unknown): AlertRuleScope => {
  const raw = normalizeObjectRecord(value, "scope_json");
  const tenantId = normalizeNonEmptyString(raw.tenant_id);
  const contentTypeRaw = normalizeNonEmptyString(raw.content_type);
  const contentKey = normalizeNonEmptyString(raw.content_key);

  const contentType = contentTypeRaw ? contentTypeRaw.toLowerCase() : null;
  const inferredContentType = !contentType && contentKey ? "test" : contentType;

  return {
    tenant_id: tenantId,
    content_type: inferredContentType,
    content_key: contentKey
  };
};

const normalizeAlertParams = (value: unknown): AlertRuleParams => {
  return normalizeObjectRecord(value, "params_json");
};

const normalizeRuleName = (value: unknown): string => {
  const normalized = normalizeNonEmptyString(value);
  if (!normalized) {
    throw new Error("name is required.");
  }

  return normalized;
};

const normalizeRuleId = (value: unknown): string => {
  const normalized = normalizeNonEmptyString(value);
  if (!normalized) {
    throw new Error("rule_id is required.");
  }

  return normalized;
};

const normalizeInstanceId = (value: unknown): string => {
  const normalized = normalizeNonEmptyString(value);
  if (!normalized) {
    throw new Error("instance_id is required.");
  }

  return normalized;
};

const normalizeLimit = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_INSTANCES_LIMIT;
  }

  const rounded = Math.floor(value);
  if (rounded < 1) {
    return DEFAULT_INSTANCES_LIMIT;
  }

  return Math.min(rounded, MAX_INSTANCES_LIMIT);
};

const toAlertRuleRecord = (row: AlertRuleRow): AlertRuleRecord => {
  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    rule_type: normalizeRuleType(row.rule_type),
    scope_json: normalizeAlertScope(row.scope_json),
    params_json: normalizeAlertParams(row.params_json),
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at)
  };
};

const toAlertInstanceRecord = (row: AlertInstanceRow): AlertInstanceRecord => {
  return {
    id: row.id,
    rule_id: row.rule_id,
    rule_name: row.rule_name,
    rule_type: normalizeRuleType(row.rule_type),
    status: normalizeStatus(row.status),
    severity: normalizeSeverity(row.severity),
    fired_at: toIsoString(row.fired_at),
    context_json: normalizeObjectRecord(row.context_json, "context_json"),
    fingerprint: row.fingerprint,
    created_at: toIsoString(row.created_at)
  };
};

export const listAlertRules = async (
  input: ListAlertRulesInput = {}
): Promise<AlertRuleRecord[]> => {
  const enabledOnly = input.enabled_only === true;
  const ruleId = normalizeNonEmptyString(input.rule_id);
  const values: unknown[] = [];
  const filters: string[] = [];

  if (enabledOnly) {
    filters.push("enabled = TRUE");
  }

  if (ruleId) {
    values.push(ruleId);
    filters.push(`id = $${values.length}`);
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
  const pool = getContentDbPool();
  const { rows } = await pool.query<AlertRuleRow>(
    `
      SELECT
        id,
        name,
        enabled,
        rule_type,
        scope_json,
        params_json,
        created_at,
        updated_at
      FROM alert_rules
      ${whereClause}
      ORDER BY created_at DESC, id DESC
    `,
    values
  );

  return rows.map((row) => toAlertRuleRecord(row));
};

export const createAlertRule = async (
  input: CreateAlertRuleInput
): Promise<AlertRuleRecord> => {
  const name = normalizeRuleName(input.name);
  const enabled = Boolean(input.enabled);
  const ruleType = normalizeRuleType(input.rule_type);
  const scopeJson = normalizeAlertScope(input.scope_json ?? {});
  const paramsJson = normalizeAlertParams(input.params_json ?? {});

  const pool = getContentDbPool();
  const { rows } = await pool.query<AlertRuleRow>(
    `
      INSERT INTO alert_rules (
        name,
        enabled,
        rule_type,
        scope_json,
        params_json
      )
      VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
      RETURNING
        id,
        name,
        enabled,
        rule_type,
        scope_json,
        params_json,
        created_at,
        updated_at
    `,
    [name, enabled, ruleType, JSON.stringify(scopeJson), JSON.stringify(paramsJson)]
  );

  const row = rows[0];
  if (!row) {
    throw new Error("Failed to create alert rule.");
  }

  return toAlertRuleRecord(row);
};

export const updateAlertRule = async (
  input: UpdateAlertRuleInput
): Promise<AlertRuleRecord | null> => {
  const id = normalizeRuleId(input.id);
  const name = normalizeRuleName(input.name);
  const enabled = Boolean(input.enabled);
  const ruleType = normalizeRuleType(input.rule_type);
  const scopeJson = normalizeAlertScope(input.scope_json ?? {});
  const paramsJson = normalizeAlertParams(input.params_json ?? {});

  const pool = getContentDbPool();
  const { rows } = await pool.query<AlertRuleRow>(
    `
      UPDATE alert_rules
      SET
        name = $2,
        enabled = $3,
        rule_type = $4,
        scope_json = $5::jsonb,
        params_json = $6::jsonb
      WHERE id = $1
      RETURNING
        id,
        name,
        enabled,
        rule_type,
        scope_json,
        params_json,
        created_at,
        updated_at
    `,
    [id, name, enabled, ruleType, JSON.stringify(scopeJson), JSON.stringify(paramsJson)]
  );

  const row = rows[0];
  return row ? toAlertRuleRecord(row) : null;
};

export const listAlertInstances = async (
  input: ListAlertInstancesInput = {}
): Promise<AlertInstanceRecord[]> => {
  const status = input.status ? normalizeStatus(input.status) : null;
  const severity = input.severity ? normalizeSeverity(input.severity) : null;
  const tenantId = normalizeNonEmptyString(input.tenant_id);
  const ruleType = input.rule_type ? normalizeRuleType(input.rule_type) : null;
  const limit = normalizeLimit(input.limit ?? DEFAULT_INSTANCES_LIMIT);

  const values: unknown[] = [];
  const filters: string[] = [];

  if (status) {
    values.push(status);
    filters.push(`ai.status = $${values.length}`);
  }

  if (severity) {
    values.push(severity);
    filters.push(`ai.severity = $${values.length}`);
  }

  if (tenantId) {
    values.push(tenantId);
    filters.push(`COALESCE(ai.context_json ->> 'tenant_id', '') = $${values.length}`);
  }

  if (ruleType) {
    values.push(ruleType);
    filters.push(`ar.rule_type = $${values.length}`);
  }

  values.push(limit);
  const limitParamIndex = values.length;

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
  const pool = getContentDbPool();
  const { rows } = await pool.query<AlertInstanceRow>(
    `
      SELECT
        ai.id,
        ai.rule_id,
        ar.name AS rule_name,
        ar.rule_type,
        ai.status,
        ai.severity,
        ai.fired_at,
        ai.context_json,
        ai.fingerprint,
        ai.created_at
      FROM alert_instances ai
      JOIN alert_rules ar
        ON ar.id = ai.rule_id
      ${whereClause}
      ORDER BY ai.fired_at DESC, ai.id DESC
      LIMIT $${limitParamIndex}
    `,
    values
  );

  return rows.map((row) => toAlertInstanceRecord(row));
};

export const updateAlertInstanceStatus = async (
  instanceIdInput: string,
  statusInput: AlertInstanceStatus
): Promise<UpdatedAlertInstanceRow | null> => {
  const instanceId = normalizeInstanceId(instanceIdInput);
  const status = normalizeStatus(statusInput);

  const pool = getContentDbPool();
  const { rows } = await pool.query<UpdatedAlertInstanceRow>(
    `
      UPDATE alert_instances
      SET status = $2
      WHERE id = $1
      RETURNING id, rule_id, status
    `,
    [instanceId, status]
  );

  return rows[0] ?? null;
};

export const insertAlertInstance = async (
  input: InsertAlertInstanceInput
): Promise<InsertAlertInstanceResult> => {
  const ruleId = normalizeRuleId(input.rule_id);
  const status = normalizeStatus(input.status ?? "open");
  const severity = normalizeSeverity(input.severity);
  const firedAt = normalizeNonEmptyString(input.fired_at);
  const fingerprint = normalizeNonEmptyString(input.fingerprint);
  const contextJson = normalizeObjectRecord(input.context_json, "context_json");

  if (!firedAt) {
    throw new Error("fired_at is required.");
  }

  if (!fingerprint) {
    throw new Error("fingerprint is required.");
  }

  const pool = getContentDbPool();
  const { rows } = await pool.query<{ id: string }>(
    `
      INSERT INTO alert_instances (
        rule_id,
        status,
        severity,
        fired_at,
        context_json,
        fingerprint
      )
      VALUES ($1, $2, $3, $4::timestamptz, $5::jsonb, $6)
      ON CONFLICT (fingerprint) DO NOTHING
      RETURNING id
    `,
    [ruleId, status, severity, firedAt, JSON.stringify(contextJson), fingerprint]
  );

  const row = rows[0];
  if (!row) {
    return {
      inserted: false,
      id: null
    };
  }

  return {
    inserted: true,
    id: row.id
  };
};

export const getAlertRuleById = async (
  ruleIdInput: string
): Promise<AlertRuleRecord | null> => {
  const ruleId = normalizeRuleId(ruleIdInput);
  const pool = getContentDbPool();
  const { rows } = await pool.query<AlertRuleRow>(
    `
      SELECT
        id,
        name,
        enabled,
        rule_type,
        scope_json,
        params_json,
        created_at,
        updated_at
      FROM alert_rules
      WHERE id = $1
      LIMIT 1
    `,
    [ruleId]
  );

  const row = rows[0];
  return row ? toAlertRuleRecord(row) : null;
};

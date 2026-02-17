export const ALERT_RULE_TYPES = [
  "conversion_drop",
  "revenue_drop",
  "refund_spike",
  "traffic_spike",
  "data_freshness_fail"
] as const;

export const ALERT_INSTANCE_STATUSES = ["open", "acknowledged", "resolved"] as const;

export const ALERT_INSTANCE_SEVERITIES = ["info", "warn", "critical"] as const;

export type AlertRuleType = (typeof ALERT_RULE_TYPES)[number];
export type AlertInstanceStatus = (typeof ALERT_INSTANCE_STATUSES)[number];
export type AlertInstanceSeverity = (typeof ALERT_INSTANCE_SEVERITIES)[number];

export type AlertRuleScope = {
  tenant_id: string | null;
  content_type: string | null;
  content_key: string | null;
};

export type AlertRuleParams = Record<string, unknown>;

export type AlertRuleRecord = {
  id: string;
  name: string;
  enabled: boolean;
  rule_type: AlertRuleType;
  scope_json: AlertRuleScope;
  params_json: AlertRuleParams;
  created_at: string;
  updated_at: string;
};

export type AlertInstanceRecord = {
  id: string;
  rule_id: string;
  rule_name: string;
  rule_type: AlertRuleType;
  status: AlertInstanceStatus;
  severity: AlertInstanceSeverity;
  fired_at: string;
  context_json: Record<string, unknown>;
  fingerprint: string;
  created_at: string;
};

export type AlertInstanceWithRuleRecord = AlertInstanceRecord & {
  scope_json: AlertRuleScope;
  params_json: AlertRuleParams;
};

export type AlertAiInsightRecord = {
  alert_instance_id: string;
  model: string;
  prompt_hash: string;
  insight_md: string;
  actions_json: unknown;
  created_at: string;
};

export type CreateAlertRuleInput = {
  name: string;
  enabled: boolean;
  rule_type: AlertRuleType;
  scope_json?: Partial<AlertRuleScope> | null;
  params_json?: Record<string, unknown> | null;
};

export type UpdateAlertRuleInput = {
  id: string;
  name: string;
  enabled: boolean;
  rule_type: AlertRuleType;
  scope_json?: Partial<AlertRuleScope> | null;
  params_json?: Record<string, unknown> | null;
};

export type ListAlertRulesInput = {
  enabled_only?: boolean;
  rule_id?: string | null;
};

export type ListAlertInstancesInput = {
  status?: AlertInstanceStatus | null;
  severity?: AlertInstanceSeverity | null;
  tenant_id?: string | null;
  rule_type?: AlertRuleType | null;
  limit?: number | null;
};

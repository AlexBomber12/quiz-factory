import { createHmac, timingSafeEqual } from "crypto";
import { normalizeString } from "@/lib/utils/strings";
import { encodeBase64Url, decodeBase64Url } from "@/lib/utils/encoding";

export const CREDITS_COOKIE = "QF_CREDITS";
export const CREDITS_COOKIE_TTL_SECONDS = 60 * 60 * 24 * 365;

const CREDITS_COOKIE_VERSION = 1;
const CONSUMED_REPORTS_CAP = 25;
const GRANT_HISTORY_CAP = 20;
const GRANT_FILTER_BITS = 2048;
const GRANT_FILTER_BYTES = GRANT_FILTER_BITS / 8;
const GRANT_FILTER_HASH_COUNT = 4;
const DEV_CREDITS_COOKIE_SECRET = "dev-credits-cookie-secret";

type CookieValue = { value: string };

type CookieStoreLike = {
  get: (name: string) => CookieValue | undefined;
};

type CookieRecordLike = Record<string, string | undefined>;

type CookieSource = CookieStoreLike | CookieRecordLike;

export type CreditsGrantMetadata = {
  grant_id: string;
  offer_key: string | null;
  product_type: string;
  pricing_variant: string;
};

type CreditsTenantEntry = {
  credits_remaining: number;
  consumed_report_keys: string[];
  grant_ids: string[];
  grant_filter: string | null;
  last_grant: CreditsGrantMetadata | null;
};

type CreditsCookiePayload = {
  v: number;
  tenants: Record<string, CreditsTenantEntry>;
};

export type CreditsState = {
  tenant_id: string;
  credits_remaining: number;
  consumed_report_keys: string[];
  grant_ids: string[];
  grant_filter: string | null;
  last_grant: CreditsGrantMetadata | null;
  payload: CreditsCookiePayload;
};

const normalizeNonNegativeInt = (value: unknown): number => {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.floor(parsed);
};

const dedupeAndCap = (values: unknown, cap: number): string[] => {
  if (!Array.isArray(values)) {
    return [];
  }

  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = normalizeString(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    result.push(normalized);
    seen.add(normalized);

    if (result.length >= cap) {
      break;
    }
  }

  return result;
};

const createEmptyGrantFilter = (): Buffer => {
  return Buffer.alloc(GRANT_FILTER_BYTES);
};

const decodeGrantFilter = (value: unknown): Buffer => {
  const normalized = normalizeString(value);
  if (!normalized) {
    return createEmptyGrantFilter();
  }

  try {
    const decoded = Buffer.from(normalized, "base64url");
    if (decoded.length !== GRANT_FILTER_BYTES) {
      return createEmptyGrantFilter();
    }

    return decoded;
  } catch {
    return createEmptyGrantFilter();
  }
};

const isGrantFilterEmpty = (filter: Buffer): boolean => {
  for (const byte of filter) {
    if (byte !== 0) {
      return false;
    }
  }

  return true;
};

const encodeGrantFilter = (filter: Buffer): string | null => {
  if (filter.length !== GRANT_FILTER_BYTES || isGrantFilterEmpty(filter)) {
    return null;
  }

  return filter.toString("base64url");
};

const computeGrantFilterIndices = (grantId: string): number[] => {
  const digest = createHmac("sha256", resolveCreditsCookieSecret()).update(grantId).digest();
  const indices: number[] = [];

  for (let index = 0; index < GRANT_FILTER_HASH_COUNT; index += 1) {
    const offset = index * 4;
    const value = digest.readUInt32BE(offset);
    indices.push(value % GRANT_FILTER_BITS);
  }

  return indices;
};

const isGrantInFilter = (filter: Buffer, grantId: string): boolean => {
  for (const index of computeGrantFilterIndices(grantId)) {
    const byteIndex = Math.floor(index / 8);
    const bitMask = 1 << (index % 8);
    if ((filter[byteIndex] & bitMask) === 0) {
      return false;
    }
  }

  return true;
};

const addGrantToFilter = (filter: Buffer, grantId: string): Buffer => {
  const nextFilter =
    filter.length === GRANT_FILTER_BYTES ? Buffer.from(filter) : createEmptyGrantFilter();

  for (const index of computeGrantFilterIndices(grantId)) {
    const byteIndex = Math.floor(index / 8);
    const bitMask = 1 << (index % 8);
    nextFilter[byteIndex] = nextFilter[byteIndex] | bitMask;
  }

  return nextFilter;
};

const getCookieValue = (cookies: CookieSource, name: string): string | null => {
  if ("get" in cookies && typeof cookies.get === "function") {
    return cookies.get(name)?.value ?? null;
  }

  const record = cookies as CookieRecordLike;
  const value = record[name];
  return typeof value === "string" ? value : null;
};



const resolveCreditsCookieSecret = (): string => {
  const secret = normalizeString(process.env.REPORT_TOKEN_SECRET);
  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("REPORT_TOKEN_SECRET is required.");
  }

  return DEV_CREDITS_COOKIE_SECRET;
};

const signPayload = (payloadEncoded: string): string => {
  return createHmac("sha256", resolveCreditsCookieSecret())
    .update(payloadEncoded)
    .digest("base64url");
};

const isSignatureValid = (provided: string, expected: string): boolean => {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
};

const sanitizeGrantMetadata = (value: unknown): CreditsGrantMetadata | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const grantId = normalizeString(record.grant_id);
  const productType = normalizeString(record.product_type);
  const pricingVariant = normalizeString(record.pricing_variant);

  if (!grantId || !productType || !pricingVariant) {
    return null;
  }

  return {
    grant_id: grantId,
    offer_key: normalizeString(record.offer_key),
    product_type: productType,
    pricing_variant: pricingVariant
  };
};

const sanitizeGrantFilter = (value: unknown): string | null => {
  return encodeGrantFilter(decodeGrantFilter(value));
};

const sanitizeTenantEntry = (entry: unknown): CreditsTenantEntry => {
  if (!entry || typeof entry !== "object") {
    return {
      credits_remaining: 0,
      consumed_report_keys: [],
      grant_ids: [],
      grant_filter: null,
      last_grant: null
    };
  }

  const record = entry as Record<string, unknown>;
  return {
    credits_remaining: normalizeNonNegativeInt(record.credits_remaining),
    consumed_report_keys: dedupeAndCap(record.consumed_report_keys, CONSUMED_REPORTS_CAP),
    grant_ids: dedupeAndCap(record.grant_ids, GRANT_HISTORY_CAP),
    grant_filter: sanitizeGrantFilter(record.grant_filter),
    last_grant: sanitizeGrantMetadata(record.last_grant)
  };
};

const sanitizePayload = (payload: unknown): CreditsCookiePayload => {
  if (!payload || typeof payload !== "object") {
    return { v: CREDITS_COOKIE_VERSION, tenants: {} };
  }

  const record = payload as Record<string, unknown>;
  const tenantsRecord =
    record.tenants && typeof record.tenants === "object" && !Array.isArray(record.tenants)
      ? (record.tenants as Record<string, unknown>)
      : {};

  const tenants: Record<string, CreditsTenantEntry> = {};
  for (const [tenantId, entry] of Object.entries(tenantsRecord)) {
    const normalizedTenantId = normalizeString(tenantId);
    if (!normalizedTenantId) {
      continue;
    }

    tenants[normalizedTenantId] = sanitizeTenantEntry(entry);
  }

  return {
    v: normalizeNonNegativeInt(record.v) || CREDITS_COOKIE_VERSION,
    tenants
  };
};

const parseCookiePayload = (value: string | null): CreditsCookiePayload => {
  const normalized = normalizeString(value);
  if (!normalized) {
    return { v: CREDITS_COOKIE_VERSION, tenants: {} };
  }

  const parts = normalized.split(".");
  if (parts.length !== 2) {
    return { v: CREDITS_COOKIE_VERSION, tenants: {} };
  }

  const [payloadEncoded, signature] = parts;
  if (!payloadEncoded || !signature) {
    return { v: CREDITS_COOKIE_VERSION, tenants: {} };
  }

  const expectedSignature = signPayload(payloadEncoded);
  if (!isSignatureValid(signature, expectedSignature)) {
    return { v: CREDITS_COOKIE_VERSION, tenants: {} };
  }

  try {
    const decoded = decodeBase64Url(payloadEncoded);
    return sanitizePayload(JSON.parse(decoded));
  } catch {
    return { v: CREDITS_COOKIE_VERSION, tenants: {} };
  }
};

const serializePayload = (payload: CreditsCookiePayload): string => {
  const sanitized = sanitizePayload(payload);
  const payloadEncoded = encodeBase64Url(JSON.stringify(sanitized));
  const signature = signPayload(payloadEncoded);
  return `${payloadEncoded}.${signature}`;
};

const getTenantEntry = (
  payload: CreditsCookiePayload,
  tenantId: string
): CreditsTenantEntry => {
  const existing = payload.tenants[tenantId];
  return sanitizeTenantEntry(existing);
};

const applyTenantEntry = (
  payload: CreditsCookiePayload,
  tenantId: string,
  entry: CreditsTenantEntry
): CreditsCookiePayload => {
  return {
    ...payload,
    tenants: {
      ...payload.tenants,
      [tenantId]: sanitizeTenantEntry(entry)
    }
  };
};

const buildState = (
  payload: CreditsCookiePayload,
  tenantId: string,
  entry: CreditsTenantEntry
): CreditsState => {
  const nextPayload = applyTenantEntry(payload, tenantId, entry);
  const tenantEntry = nextPayload.tenants[tenantId];

  return {
    tenant_id: tenantId,
    credits_remaining: tenantEntry.credits_remaining,
    consumed_report_keys: tenantEntry.consumed_report_keys,
    grant_ids: tenantEntry.grant_ids,
    grant_filter: tenantEntry.grant_filter,
    last_grant: tenantEntry.last_grant,
    payload: nextPayload
  };
};

const withTenantEntry = (
  state: CreditsState,
  entry: CreditsTenantEntry
): CreditsState => {
  return buildState(state.payload, state.tenant_id, entry);
};

export const createReportKey = (
  tenantId: string,
  testId: string,
  sessionId: string
): string => {
  return `${tenantId}:${testId}:${sessionId}`;
};

export const parseCreditsCookie = (
  cookies: CookieSource,
  tenantId: string
): CreditsState => {
  const normalizedTenantId = normalizeString(tenantId);
  if (!normalizedTenantId) {
    const payload = { v: CREDITS_COOKIE_VERSION, tenants: {} };
    return buildState(payload, "tenant-unknown", getTenantEntry(payload, "tenant-unknown"));
  }

  const payload = parseCookiePayload(getCookieValue(cookies, CREDITS_COOKIE));
  const entry = getTenantEntry(payload, normalizedTenantId);
  return buildState(payload, normalizedTenantId, entry);
};

export const serializeCreditsCookie = (state: CreditsState): string => {
  return serializePayload(state.payload);
};

export const hasGrantId = (state: CreditsState, grantId: string): boolean => {
  const normalizedGrantId = normalizeString(grantId);
  if (!normalizedGrantId) {
    return false;
  }

  if (state.grant_ids.includes(normalizedGrantId)) {
    return true;
  }

  const grantFilter = decodeGrantFilter(state.grant_filter);
  return isGrantInFilter(grantFilter, normalizedGrantId);
};

export const grantCredits = (
  state: CreditsState,
  credits: number,
  grantId: string
): CreditsState => {
  const creditsToGrant =
    typeof credits === "number" && Number.isFinite(credits) ? Math.floor(credits) : 0;
  if (creditsToGrant <= 0) {
    return state;
  }

  const normalizedGrantId = normalizeString(grantId);
  if (normalizedGrantId && hasGrantId(state, normalizedGrantId)) {
    return state;
  }

  const grantFilter = decodeGrantFilter(state.grant_filter);
  const nextGrantIds = normalizedGrantId
    ? dedupeAndCap([normalizedGrantId, ...state.grant_ids], GRANT_HISTORY_CAP)
    : state.grant_ids;
  const nextGrantFilter = normalizedGrantId
    ? encodeGrantFilter(addGrantToFilter(grantFilter, normalizedGrantId))
    : state.grant_filter;

  const nextEntry: CreditsTenantEntry = {
    credits_remaining: state.credits_remaining + creditsToGrant,
    consumed_report_keys: state.consumed_report_keys,
    grant_ids: nextGrantIds,
    grant_filter: nextGrantFilter,
    last_grant: state.last_grant
  };

  return withTenantEntry(state, nextEntry);
};

export const setLastGrantMetadata = (
  state: CreditsState,
  metadata: CreditsGrantMetadata | null
): CreditsState => {
  const sanitized = sanitizeGrantMetadata(metadata);
  if (!sanitized) {
    return state;
  }

  const nextEntry: CreditsTenantEntry = {
    credits_remaining: state.credits_remaining,
    consumed_report_keys: state.consumed_report_keys,
    grant_ids: state.grant_ids,
    grant_filter: state.grant_filter,
    last_grant: sanitized
  };

  return withTenantEntry(state, nextEntry);
};

export const consumeCreditForReport = (
  state: CreditsState,
  reportKey: string
): { new_state: CreditsState; consumed: boolean } => {
  const normalizedReportKey = normalizeString(reportKey);
  if (!normalizedReportKey) {
    return { new_state: state, consumed: false };
  }

  if (state.consumed_report_keys.includes(normalizedReportKey)) {
    return { new_state: state, consumed: false };
  }

  if (state.credits_remaining <= 0) {
    return { new_state: state, consumed: false };
  }

  const nextEntry: CreditsTenantEntry = {
    credits_remaining: state.credits_remaining - 1,
    consumed_report_keys: dedupeAndCap(
      [normalizedReportKey, ...state.consumed_report_keys],
      CONSUMED_REPORTS_CAP
    ),
    grant_ids: state.grant_ids,
    grant_filter: state.grant_filter,
    last_grant: state.last_grant
  };

  return {
    new_state: withTenantEntry(state, nextEntry),
    consumed: true
  };
};

export const CONSUMED_REPORTS_MAX = CONSUMED_REPORTS_CAP;
export const GRANT_HISTORY_MAX = GRANT_HISTORY_CAP;

import { createHmac, timingSafeEqual } from "crypto";

import type { AnalyticsEventProperties, AnalyticsEventName } from "../analytics/events";
import { normalizeString } from "../analytics/session";
import { validateAnalyticsEventPayload } from "../analytics/validate";
import { parseStripeMetadata } from "./metadata";
import type {
  StripeAnalyticsStore,
  StripeDisputeRow,
  StripeFeeRow,
  StripePurchaseRow,
  StripeRefundRow,
  StripeWebhookEventRow
} from "./store";

type StripeWebhookEvent = {
  id: string;
  type: string;
  created: number;
  livemode: boolean;
  api_version?: string | null;
  request?: { id?: string | null };
  data: { object: Record<string, unknown> };
};

type StripeCharge = {
  id: string;
  payment_intent?: string | null | { id?: string | null };
  metadata?: Record<string, string | null | undefined>;
  balance_transaction?: string | null | { id?: string | null };
  refunds?: { data?: StripeRefund[] } | null;
  customer?: string | null | { id?: string | null };
  created?: number | null;
};

type StripeRefund = {
  id: string;
  amount?: number | null;
  created?: number | null;
  status?: string | null;
};

type StripeDispute = {
  id: string;
  charge?: string | null | { id?: string | null };
  amount?: number | null;
  created?: number | null;
  status?: string | null;
};

type StripeCheckoutSession = {
  id: string;
  object?: string;
  amount_total?: number | null;
  currency?: string | null;
  payment_status?: string | null;
  status?: string | null;
  customer?: string | null;
  payment_intent?: string | null;
  metadata?: Record<string, string | null | undefined>;
  created?: number | null;
  locale?: string | null;
  client_reference_id?: string | null;
};

type StripePaymentIntent = {
  id: string;
  latest_charge?: string | null | { id?: string | null };
  metadata?: Record<string, string | null | undefined>;
};

type StripeBalanceTransaction = {
  id: string;
  fee?: number | null;
  net?: number | null;
};

export type StripeClient = {
  charges: {
    retrieve: (id: string) => Promise<StripeCharge>;
  };
  paymentIntents: {
    retrieve: (id: string) => Promise<StripePaymentIntent>;
  };
  balanceTransactions: {
    retrieve: (id: string) => Promise<StripeBalanceTransaction>;
  };
};

export type StripeWebhookDependencies = {
  store: StripeAnalyticsStore;
  stripeClient?: StripeClient | null;
  captureEvent?: (
    eventName: AnalyticsEventName,
    properties: AnalyticsEventProperties
  ) => Promise<unknown>;
  now?: () => Date;
};

export type StripeWebhookResult = {
  status: "ok" | "duplicate" | "ignored" | "invalid";
  message?: string;
};

type StripeSignatureParts = {
  timestamp: number;
  signatures: string[];
};

const STRIPE_SIGNATURE_VERSION = "v1";
const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300;

const parseStripeSignatureHeader = (header: string): StripeSignatureParts | null => {
  const parts = header.split(",");
  let timestamp: number | null = null;
  const signatures: string[] = [];

  for (const part of parts) {
    const [key, value] = part.split("=", 2).map((item) => item.trim());
    if (!key || !value) {
      continue;
    }

    if (key === "t") {
      const parsedTimestamp = Number(value);
      if (Number.isFinite(parsedTimestamp)) {
        timestamp = parsedTimestamp;
      }
    }

    if (key === STRIPE_SIGNATURE_VERSION) {
      signatures.push(value);
    }
  }

  if (!timestamp || signatures.length === 0) {
    return null;
  }

  return { timestamp, signatures };
};

const computeStripeSignature = (
  payload: string,
  timestamp: number,
  secret: string
): string => {
  const signedPayload = `${timestamp}.${payload}`;
  return createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");
};

const safeCompare = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
};

export const verifyStripeSignature = (options: {
  payload: string;
  signatureHeader: string | null;
  secret: string;
  toleranceSeconds?: number;
  now?: () => Date;
}): boolean => {
  if (!options.signatureHeader) {
    return false;
  }

  const parsed = parseStripeSignatureHeader(options.signatureHeader);
  if (!parsed) {
    return false;
  }

  const now = options.now ? options.now().getTime() : Date.now();
  const toleranceMs =
    (options.toleranceSeconds ?? STRIPE_SIGNATURE_TOLERANCE_SECONDS) * 1000;
  const signatureTimestampMs = parsed.timestamp * 1000;
  if (Math.abs(now - signatureTimestampMs) > toleranceMs) {
    return false;
  }

  const expectedSignature = computeStripeSignature(
    options.payload,
    parsed.timestamp,
    options.secret
  );

  return parsed.signatures.some((signature) => safeCompare(signature, expectedSignature));
};

const toIsoStringFromSeconds = (value: number | null | undefined, fallback: Date): string =>
  typeof value === "number" && Number.isFinite(value)
    ? new Date(value * 1000).toISOString()
    : fallback.toISOString();

const toAmountEur = (value: number | null | undefined): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Number((value / 100).toFixed(2));
};

const extractId = (value: unknown): string | null => {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object" && "id" in value) {
    const idValue = (value as { id?: unknown }).id;
    return typeof idValue === "string" ? idValue : null;
  }

  return null;
};

const buildWebhookEventRow = (
  event: StripeWebhookEvent,
  receivedAt: Date
): StripeWebhookEventRow => {
  const eventObject = event.data?.object ?? {};
  const objectType = normalizeString(eventObject.object);
  const objectId = normalizeString(eventObject.id);

  return {
    stripe_event_id: event.id,
    type: event.type,
    created_utc: toIsoStringFromSeconds(event.created, receivedAt),
    livemode: Boolean(event.livemode),
    object_type: objectType,
    object_id: objectId,
    request_id: normalizeString(event.request?.id),
    api_version: normalizeString(event.api_version),
    received_utc: receivedAt.toISOString()
  };
};

export const buildPurchaseRowFromCheckoutSession = (
  session: StripeCheckoutSession,
  fallbackCreatedAt: Date
): StripePurchaseRow => {
  const metadata = parseStripeMetadata(session.metadata);
  const createdUtc = toIsoStringFromSeconds(session.created, fallbackCreatedAt);
  const status = normalizeString(session.payment_status ?? session.status);
  const currency = normalizeString(session.currency)?.toLowerCase() ?? null;
  const purchaseId =
    metadata.purchase_id ??
    normalizeString(session.client_reference_id) ??
    normalizeString(session.payment_intent) ??
    normalizeString(session.id) ??
    "unknown";

  return {
    purchase_id: purchaseId,
    provider: "stripe",
    created_utc: createdUtc,
    amount_eur: toAmountEur(session.amount_total),
    currency,
    status,
    product_type: metadata.product_type,
    is_upsell: metadata.is_upsell,
    tenant_id: metadata.tenant_id,
    test_id: metadata.test_id,
    session_id: metadata.session_id,
    distinct_id: metadata.distinct_id,
    locale: metadata.locale ?? normalizeString(session.locale),
    utm_source: metadata.utm_source,
    utm_medium: metadata.utm_medium,
    utm_campaign: metadata.utm_campaign,
    utm_content: metadata.utm_content,
    utm_term: metadata.utm_term,
    fbclid: metadata.fbclid,
    gclid: metadata.gclid,
    ttclid: metadata.ttclid,
    stripe_customer_id: normalizeString(session.customer),
    stripe_payment_intent_id: normalizeString(session.payment_intent)
  };
};

const buildFinanceBaseProperties = (
  metadata: ReturnType<typeof parseStripeMetadata>,
  timestampUtc: string
): AnalyticsEventProperties => {
  const fallbackDistinctId =
    metadata.distinct_id ?? metadata.session_id ?? metadata.purchase_id ?? "unknown";
  const fallbackSessionId = metadata.session_id ?? metadata.purchase_id ?? "unknown";
  const fallbackTestId = metadata.test_id ?? "unknown";
  const fallbackTenantId = metadata.tenant_id ?? "tenant-unknown";

  return {
    tenant_id: fallbackTenantId,
    session_id: fallbackSessionId,
    distinct_id: fallbackDistinctId,
    test_id: fallbackTestId,
    timestamp_utc: timestampUtc,
    utm_source: metadata.utm_source,
    utm_medium: metadata.utm_medium,
    utm_campaign: metadata.utm_campaign,
    utm_content: metadata.utm_content,
    utm_term: metadata.utm_term,
    fbclid: metadata.fbclid,
    gclid: metadata.gclid,
    ttclid: metadata.ttclid,
    referrer: null,
    country: null,
    language: null,
    device_type: metadata.device_type,
    locale: metadata.locale
  };
};

const captureValidatedEvent = (
  eventName: AnalyticsEventName,
  properties: AnalyticsEventProperties,
  deps: StripeWebhookDependencies
): void => {
  if (!deps.captureEvent) {
    return;
  }

  const validation = validateAnalyticsEventPayload(
    eventName,
    properties as Record<string, unknown>
  );
  if (!validation.ok) {
    return;
  }

  void deps.captureEvent(eventName, properties).catch(() => null);
};

const resolveChargeMetadata = async (
  charge: StripeCharge,
  stripeClient?: StripeClient | null
) => {
  const metadata = parseStripeMetadata(charge.metadata);
  if (metadata.tenant_id || !stripeClient) {
    return metadata;
  }

  const paymentIntentId = normalizeString(extractId(charge.payment_intent));
  if (!paymentIntentId) {
    return metadata;
  }

  const paymentIntent = await stripeClient.paymentIntents.retrieve(paymentIntentId);
  return parseStripeMetadata(paymentIntent.metadata);
};

const resolveBalanceTransaction = async (
  session: StripeCheckoutSession,
  stripeClient?: StripeClient | null
): Promise<StripeFeeRow | null> => {
  if (!stripeClient) {
    return null;
  }

  const paymentIntentId = normalizeString(session.payment_intent);
  if (!paymentIntentId) {
    return null;
  }

  const paymentIntent = await stripeClient.paymentIntents.retrieve(paymentIntentId);
  const chargeId = normalizeString(extractId(paymentIntent.latest_charge));
  if (!chargeId) {
    return null;
  }

  const charge = await stripeClient.charges.retrieve(chargeId);
  const balanceTransactionId = normalizeString(extractId(charge.balance_transaction));
  if (!balanceTransactionId) {
    return null;
  }

  const balanceTransaction = await stripeClient.balanceTransactions.retrieve(
    balanceTransactionId
  );

  return {
    purchase_id:
      parseStripeMetadata(session.metadata).purchase_id ??
      normalizeString(session.id) ??
      null,
    balance_transaction_id: balanceTransactionId,
    created_utc: toIsoStringFromSeconds(charge.created ?? session.created, new Date()),
    fee_eur: toAmountEur(balanceTransaction.fee),
    net_eur: toAmountEur(balanceTransaction.net)
  };
};

const handleCheckoutSessionCompleted = async (
  event: StripeWebhookEvent,
  deps: StripeWebhookDependencies,
  receivedAt: Date
): Promise<StripeWebhookResult> => {
  const session = event.data.object as StripeCheckoutSession;
  const purchaseRow = buildPurchaseRowFromCheckoutSession(session, receivedAt);
  const purchaseInserted = await deps.store.recordPurchase(purchaseRow);

  if (purchaseInserted) {
    const feeRow = await resolveBalanceTransaction(session, deps.stripeClient);
    if (feeRow) {
      await deps.store.recordFee(feeRow);
    }

    const metadata = parseStripeMetadata(session.metadata);
    const properties = buildFinanceBaseProperties(metadata, purchaseRow.created_utc);
    properties.purchase_id = purchaseRow.purchase_id;
    properties.amount_eur = purchaseRow.amount_eur;
    properties.currency = purchaseRow.currency;
    properties.product_type = purchaseRow.product_type;
    properties.payment_provider = "stripe";
    properties.is_upsell = purchaseRow.is_upsell;
    captureValidatedEvent("purchase_success", properties, deps);
  }

  return { status: "ok" };
};

const handleCheckoutSessionFailed = async (
  event: StripeWebhookEvent,
  deps: StripeWebhookDependencies,
  receivedAt: Date
): Promise<StripeWebhookResult> => {
  const session = event.data.object as StripeCheckoutSession;
  const metadata = parseStripeMetadata(session.metadata);
  const purchaseId =
    metadata.purchase_id ??
    normalizeString(session.client_reference_id) ??
    normalizeString(session.payment_intent) ??
    normalizeString(session.id) ??
    "unknown";

  const properties = buildFinanceBaseProperties(
    metadata,
    toIsoStringFromSeconds(event.created, receivedAt)
  );
  properties.purchase_id = purchaseId;
  properties.failure_reason = event.type;
  captureValidatedEvent("purchase_failed", properties, deps);

  return { status: "ok" };
};

const handleChargeRefunded = async (
  event: StripeWebhookEvent,
  deps: StripeWebhookDependencies,
  receivedAt: Date
): Promise<StripeWebhookResult> => {
  const charge = event.data.object as StripeCharge;
  const metadata = await resolveChargeMetadata(charge, deps.stripeClient);
  const purchaseId =
    metadata.purchase_id ?? normalizeString(extractId(charge.payment_intent)) ?? null;
  const refunds = charge.refunds?.data ?? [];

  for (const refund of refunds) {
    const refundRow: StripeRefundRow = {
      refund_id: refund.id,
      purchase_id: purchaseId,
      created_utc: toIsoStringFromSeconds(refund.created, receivedAt),
      amount_eur: toAmountEur(refund.amount),
      status: normalizeString(refund.status)
    };

    const inserted = await deps.store.recordRefund(refundRow);
    if (inserted) {
      const properties = buildFinanceBaseProperties(metadata, refundRow.created_utc);
      properties.purchase_id = purchaseId ?? refundRow.refund_id;
      properties.refund_id = refundRow.refund_id;
      properties.amount_eur = refundRow.amount_eur;
      properties.payment_provider = "stripe";
      captureValidatedEvent("refund_issued", properties, deps);
    }
  }

  return { status: "ok" };
};

const handleDisputeCreated = async (
  event: StripeWebhookEvent,
  deps: StripeWebhookDependencies,
  receivedAt: Date
): Promise<StripeWebhookResult> => {
  const dispute = event.data.object as StripeDispute;
  let metadata = parseStripeMetadata();
  let purchaseId: string | null = null;

  const chargeId = normalizeString(extractId(dispute.charge));
  if (chargeId && deps.stripeClient) {
    const charge = await deps.stripeClient.charges.retrieve(chargeId);
    metadata = await resolveChargeMetadata(charge, deps.stripeClient);
    purchaseId =
      metadata.purchase_id ?? normalizeString(extractId(charge.payment_intent)) ?? chargeId;
  }

  const disputeRow: StripeDisputeRow = {
    dispute_id: dispute.id,
    purchase_id: purchaseId,
    created_utc: toIsoStringFromSeconds(dispute.created, receivedAt),
    amount_eur: toAmountEur(dispute.amount),
    status: normalizeString(dispute.status)
  };

  const inserted = await deps.store.recordDispute(disputeRow);
  if (inserted) {
    const properties = buildFinanceBaseProperties(metadata, disputeRow.created_utc);
    properties.purchase_id = purchaseId ?? disputeRow.dispute_id;
    properties.dispute_id = disputeRow.dispute_id;
    properties.amount_eur = disputeRow.amount_eur;
    properties.payment_provider = "stripe";
    captureValidatedEvent("dispute_opened", properties, deps);
  }

  return { status: "ok" };
};

export const handleStripeWebhookEvent = async (
  event: StripeWebhookEvent,
  deps: StripeWebhookDependencies
): Promise<StripeWebhookResult> => {
  const receivedAt = deps.now ? deps.now() : new Date();
  const webhookRow = buildWebhookEventRow(event, receivedAt);
  const inserted = await deps.store.recordWebhookEvent(webhookRow);
  if (!inserted) {
    return { status: "duplicate" };
  }

  switch (event.type) {
    case "checkout.session.completed":
      return handleCheckoutSessionCompleted(event, deps, receivedAt);
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired":
      return handleCheckoutSessionFailed(event, deps, receivedAt);
    case "charge.refunded":
      return handleChargeRefunded(event, deps, receivedAt);
    case "charge.dispute.created":
      return handleDisputeCreated(event, deps, receivedAt);
    default:
      return { status: "ignored" };
  }
};

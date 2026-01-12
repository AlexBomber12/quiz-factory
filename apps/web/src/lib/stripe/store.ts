export type StripeWebhookEventRow = {
  stripe_event_id: string;
  type: string;
  created_utc: string;
  livemode: boolean;
  object_type: string | null;
  object_id: string | null;
  request_id: string | null;
  api_version: string | null;
  received_utc: string;
};

export type StripePurchaseRow = {
  purchase_id: string;
  provider: string;
  created_utc: string;
  amount_eur: number | null;
  currency: string | null;
  status: string | null;
  product_type: string | null;
  is_upsell: boolean | null;
  tenant_id: string | null;
  test_id: string | null;
  session_id: string | null;
  distinct_id: string | null;
  locale: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  fbclid: string | null;
  gclid: string | null;
  ttclid: string | null;
  stripe_customer_id: string | null;
  stripe_payment_intent_id: string | null;
};

export type StripeRefundRow = {
  refund_id: string;
  purchase_id: string | null;
  created_utc: string;
  amount_eur: number | null;
  status: string | null;
};

export type StripeDisputeRow = {
  dispute_id: string;
  purchase_id: string | null;
  created_utc: string;
  amount_eur: number | null;
  status: string | null;
};

export type StripeFeeRow = {
  purchase_id: string | null;
  balance_transaction_id: string;
  created_utc: string;
  fee_eur: number | null;
  net_eur: number | null;
};

export type StripeAnalyticsStore = {
  recordWebhookEvent: (row: StripeWebhookEventRow) => Promise<boolean>;
  recordPurchase: (row: StripePurchaseRow) => Promise<boolean>;
  recordRefund: (row: StripeRefundRow) => Promise<boolean>;
  recordDispute: (row: StripeDisputeRow) => Promise<boolean>;
  recordFee: (row: StripeFeeRow) => Promise<boolean>;
};

export class InMemoryStripeAnalyticsStore implements StripeAnalyticsStore {
  readonly webhookEvents: StripeWebhookEventRow[] = [];
  readonly purchases: StripePurchaseRow[] = [];
  readonly refunds: StripeRefundRow[] = [];
  readonly disputes: StripeDisputeRow[] = [];
  readonly fees: StripeFeeRow[] = [];

  private webhookEventIds = new Set<string>();
  private purchaseIds = new Set<string>();
  private refundIds = new Set<string>();
  private disputeIds = new Set<string>();
  private feeTransactionIds = new Set<string>();

  async recordWebhookEvent(row: StripeWebhookEventRow): Promise<boolean> {
    if (this.webhookEventIds.has(row.stripe_event_id)) {
      return false;
    }

    this.webhookEventIds.add(row.stripe_event_id);
    this.webhookEvents.push(row);
    return true;
  }

  async recordPurchase(row: StripePurchaseRow): Promise<boolean> {
    if (this.purchaseIds.has(row.purchase_id)) {
      return false;
    }

    this.purchaseIds.add(row.purchase_id);
    this.purchases.push(row);
    return true;
  }

  async recordRefund(row: StripeRefundRow): Promise<boolean> {
    if (this.refundIds.has(row.refund_id)) {
      return false;
    }

    this.refundIds.add(row.refund_id);
    this.refunds.push(row);
    return true;
  }

  async recordDispute(row: StripeDisputeRow): Promise<boolean> {
    if (this.disputeIds.has(row.dispute_id)) {
      return false;
    }

    this.disputeIds.add(row.dispute_id);
    this.disputes.push(row);
    return true;
  }

  async recordFee(row: StripeFeeRow): Promise<boolean> {
    if (this.feeTransactionIds.has(row.balance_transaction_id)) {
      return false;
    }

    this.feeTransactionIds.add(row.balance_transaction_id);
    this.fees.push(row);
    return true;
  }
}

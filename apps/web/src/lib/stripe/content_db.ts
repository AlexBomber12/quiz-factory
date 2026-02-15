import { getContentDbPool, hasContentDatabaseUrl } from "../content_db/pool";

import type {
  StripeAnalyticsStore,
  StripeDisputeRow,
  StripeFeeRow,
  StripePurchaseRow,
  StripeRefundRow,
  StripeWebhookEventRow
} from "./store";

type ContentDbClient = {
  query: (text: string, values: unknown[]) => Promise<{ rowCount: number | null }>;
};

export class ContentDbStripeAnalyticsStore implements StripeAnalyticsStore {
  constructor(private readonly client: ContentDbClient = getContentDbPool()) {}

  private async insert(query: string, values: unknown[]): Promise<boolean> {
    const { rowCount } = await this.client.query(query, values);
    return (rowCount ?? 0) > 0;
  }

  async recordWebhookEvent(row: StripeWebhookEventRow): Promise<boolean> {
    return this.insert(
      `
        INSERT INTO stripe_webhook_events_min (
          stripe_event_id,
          type,
          created_utc,
          livemode,
          object_type,
          object_id,
          request_id,
          api_version,
          received_utc
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (stripe_event_id) DO NOTHING
      `,
      [
        row.stripe_event_id,
        row.type,
        row.created_utc,
        row.livemode,
        row.object_type,
        row.object_id,
        row.request_id,
        row.api_version,
        row.received_utc
      ]
    );
  }

  async recordPurchase(row: StripePurchaseRow): Promise<boolean> {
    return this.insert(
      `
        INSERT INTO stripe_purchases (
          purchase_id,
          provider,
          created_utc,
          amount_eur,
          currency,
          status,
          offer_key,
          product_type,
          pricing_variant,
          credits_granted,
          unit_price_eur,
          is_upsell,
          tenant_id,
          test_id,
          session_id,
          distinct_id,
          locale,
          utm_source,
          utm_medium,
          utm_campaign,
          utm_content,
          utm_term,
          fbclid,
          gclid,
          ttclid,
          stripe_customer_id,
          stripe_payment_intent_id
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19,
          $20, $21, $22, $23, $24, $25, $26, $27
        )
        ON CONFLICT (purchase_id) DO NOTHING
      `,
      [
        row.purchase_id,
        row.provider,
        row.created_utc,
        row.amount_eur,
        row.currency,
        row.status,
        row.offer_key,
        row.product_type,
        row.pricing_variant,
        row.credits_granted,
        row.unit_price_eur,
        row.is_upsell,
        row.tenant_id,
        row.test_id,
        row.session_id,
        row.distinct_id,
        row.locale,
        row.utm_source,
        row.utm_medium,
        row.utm_campaign,
        row.utm_content,
        row.utm_term,
        row.fbclid,
        row.gclid,
        row.ttclid,
        row.stripe_customer_id,
        row.stripe_payment_intent_id
      ]
    );
  }

  async recordRefund(row: StripeRefundRow): Promise<boolean> {
    return this.insert(
      `
        INSERT INTO stripe_refunds (
          refund_id,
          purchase_id,
          created_utc,
          amount_eur,
          status
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (refund_id) DO NOTHING
      `,
      [
        row.refund_id,
        row.purchase_id,
        row.created_utc,
        row.amount_eur,
        row.status
      ]
    );
  }

  async recordDispute(row: StripeDisputeRow): Promise<boolean> {
    return this.insert(
      `
        INSERT INTO stripe_disputes (
          dispute_id,
          purchase_id,
          created_utc,
          amount_eur,
          status
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (dispute_id) DO NOTHING
      `,
      [
        row.dispute_id,
        row.purchase_id,
        row.created_utc,
        row.amount_eur,
        row.status
      ]
    );
  }

  async recordFee(row: StripeFeeRow): Promise<boolean> {
    return this.insert(
      `
        INSERT INTO stripe_fees (
          balance_transaction_id,
          purchase_id,
          created_utc,
          fee_eur,
          net_eur
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (balance_transaction_id) DO NOTHING
      `,
      [
        row.balance_transaction_id,
        row.purchase_id,
        row.created_utc,
        row.fee_eur,
        row.net_eur
      ]
    );
  }
}

export const createStripeContentDbStore = (): ContentDbStripeAnalyticsStore | null => {
  if (!hasContentDatabaseUrl()) {
    return null;
  }

  return new ContentDbStripeAnalyticsStore();
};

import { BigQuery } from "@google-cloud/bigquery";

import type {
  StripeAnalyticsStore,
  StripeDisputeRow,
  StripeFeeRow,
  StripePurchaseRow,
  StripeRefundRow,
  StripeWebhookEventRow
} from "./store";

const DEFAULT_DATASET_ID = "raw_stripe";

const buildMergeQuery = (
  datasetId: string,
  table: string,
  idField: string,
  row: Record<string, unknown>
): { query: string; params: Record<string, unknown> } => {
  const columns = Object.keys(row);
  const columnList = columns.map((column) => `\`${column}\``).join(", ");
  const selectList = columns.map((column) => `@${column} AS ${column}`).join(", ");
  const valuesList = columns.map((column) => `S.${column}`).join(", ");

  const query = `
    MERGE \`${datasetId}.${table}\` T
    USING (SELECT ${selectList}) S
    ON T.${idField} = S.${idField}
    WHEN NOT MATCHED THEN
      INSERT (${columnList}) VALUES (${valuesList})
  `;

  return { query, params: row };
};

export class BigQueryStripeAnalyticsStore implements StripeAnalyticsStore {
  private datasetId: string;

  constructor(private bigquery: BigQuery, datasetId = DEFAULT_DATASET_ID) {
    this.datasetId = datasetId;
  }

  private async runMerge(
    table: string,
    idField: string,
    row: Record<string, unknown>
  ): Promise<boolean> {
    const { query, params } = buildMergeQuery(this.datasetId, table, idField, row);
    const [job] = await this.bigquery.createQueryJob({ query, params });
    await job.getQueryResults();
    const insertedCount = Number(
      job.metadata.statistics?.dmlStats?.insertedRowCount ?? 0
    );
    return insertedCount > 0;
  }

  async recordWebhookEvent(row: StripeWebhookEventRow): Promise<boolean> {
    return this.runMerge("webhook_events_min", "stripe_event_id", row);
  }

  async recordPurchase(row: StripePurchaseRow): Promise<boolean> {
    return this.runMerge("purchases", "purchase_id", row);
  }

  async recordRefund(row: StripeRefundRow): Promise<boolean> {
    return this.runMerge("refunds", "refund_id", row);
  }

  async recordDispute(row: StripeDisputeRow): Promise<boolean> {
    return this.runMerge("disputes", "dispute_id", row);
  }

  async recordFee(row: StripeFeeRow): Promise<boolean> {
    return this.runMerge("fees", "balance_transaction_id", row);
  }
}

export const createStripeBigQueryStore = (): BigQueryStripeAnalyticsStore => {
  const projectId =
    process.env.BIGQUERY_PROJECT_ID ??
    process.env.GOOGLE_CLOUD_PROJECT ??
    process.env.GCP_PROJECT;
  const datasetId = process.env.BIGQUERY_STRIPE_DATASET ?? DEFAULT_DATASET_ID;
  const bigquery = projectId ? new BigQuery({ projectId }) : new BigQuery();

  return new BigQueryStripeAnalyticsStore(bigquery, datasetId);
};

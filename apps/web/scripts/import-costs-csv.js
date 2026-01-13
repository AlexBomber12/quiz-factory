#!/usr/bin/env node
/* global console, process, require */
"use strict";

const fs = require("fs");
const path = require("path");
const { BigQuery } = require("@google-cloud/bigquery");

const TABLE_CONFIGS = {
  costs_daily: {
    mergeKeys: ["date", "cost_type", "tenant_id", "locale", "notes"],
    schema: [
      { name: "date", type: "DATE" },
      { name: "cost_type", type: "STRING" },
      { name: "amount_eur", type: "NUMERIC" },
      { name: "tenant_id", type: "STRING" },
      { name: "locale", type: "STRING" },
      { name: "notes", type: "STRING" }
    ]
  },
  ad_spend_daily: {
    mergeKeys: ["date", "platform", "account_id", "campaign_id"],
    schema: [
      { name: "date", type: "DATE" },
      { name: "platform", type: "STRING" },
      { name: "account_id", type: "STRING" },
      { name: "campaign_id", type: "STRING" },
      { name: "campaign_name", type: "STRING" },
      { name: "utm_campaign", type: "STRING" },
      { name: "amount_eur", type: "NUMERIC" },
      { name: "impressions", type: "INT64" },
      { name: "clicks", type: "INT64" }
    ]
  },
  campaign_map: {
    mergeKeys: ["platform", "account_id", "campaign_id", "valid_from"],
    schema: [
      { name: "platform", type: "STRING" },
      { name: "account_id", type: "STRING" },
      { name: "campaign_id", type: "STRING" },
      { name: "utm_campaign", type: "STRING" },
      { name: "valid_from", type: "DATE" },
      { name: "valid_to", type: "DATE" },
      { name: "notes", type: "STRING" }
    ]
  }
};

const usage = () => {
  console.error(
    [
      "Usage: node apps/web/scripts/import-costs-csv.js --table <table> --file <path>",
      "",
      "Tables:",
      "  - costs_daily",
      "  - ad_spend_daily",
      "  - campaign_map",
      "",
      "Environment:",
      "  BIGQUERY_PROJECT_ID (optional)",
      "  BIGQUERY_RAW_COSTS_DATASET (default: raw_costs)",
      "  BIGQUERY_TMP_DATASET (default: tmp)",
      "",
      "Notes:",
      "  - CSV must include a header row.",
      "  - Column order must match the table schema."
    ].join("\n")
  );
};

const parseArgs = (args) => {
  const options = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--table") {
      options.table = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--file") {
      options.file = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    console.error(`Unknown argument: ${arg}`);
    usage();
    process.exit(1);
  }
  return options;
};

const buildMergeCondition = (keys) =>
  keys
    .map(
      (key) =>
        `(T.\`${key}\` = S.\`${key}\` OR (T.\`${key}\` IS NULL AND S.\`${key}\` IS NULL))`
    )
    .join(" AND ");

const buildMergeQuery = (datasetId, table, tmpDatasetId, tmpTable, config) => {
  const columns = config.schema.map((field) => field.name);
  const columnList = columns.map((column) => `\`${column}\``).join(", ");
  const valuesList = columns.map((column) => `S.\`${column}\``).join(", ");
  const updateList = columns
    .map((column) => `\`${column}\` = S.\`${column}\``)
    .join(", ");
  const condition = buildMergeCondition(config.mergeKeys);

  return `
    MERGE \`${datasetId}.${table}\` T
    USING \`${tmpDatasetId}.${tmpTable}\` S
    ON ${condition}
    WHEN MATCHED THEN
      UPDATE SET ${updateList}
    WHEN NOT MATCHED THEN
      INSERT (${columnList}) VALUES (${valuesList})
  `;
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  if (!options.table || !options.file) {
    usage();
    process.exit(1);
  }

  const config = TABLE_CONFIGS[options.table];
  if (!config) {
    console.error(`Unsupported table: ${options.table}`);
    usage();
    process.exit(1);
  }

  const filePath = path.resolve(options.file);
  if (!fs.existsSync(filePath)) {
    console.error(`CSV not found: ${filePath}`);
    process.exit(1);
  }

  const projectId =
    process.env.BIGQUERY_PROJECT_ID ??
    process.env.GOOGLE_CLOUD_PROJECT ??
    process.env.GCP_PROJECT;
  const datasetId = process.env.BIGQUERY_RAW_COSTS_DATASET ?? "raw_costs";
  const tmpDatasetId = process.env.BIGQUERY_TMP_DATASET ?? "tmp";
  const bigquery = projectId ? new BigQuery({ projectId }) : new BigQuery();

  const tempTableId = `tmp_${options.table}_${Date.now()}`;
  const tmpDataset = bigquery.dataset(tmpDatasetId);
  const tmpTable = tmpDataset.table(tempTableId);

  try {
    await tmpTable.create({ schema: config.schema });
    const [loadJob] = await tmpTable.load(filePath, {
      sourceFormat: "CSV",
      skipLeadingRows: 1,
      writeDisposition: "WRITE_TRUNCATE",
      schema: config.schema
    });
    await loadJob.promise();

    const query = buildMergeQuery(
      datasetId,
      options.table,
      tmpDatasetId,
      tempTableId,
      config
    );
    const [mergeJob] = await bigquery.createQueryJob({ query });
    await mergeJob.getQueryResults();
  } finally {
    await tmpTable.delete({ ignoreNotFound: true });
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

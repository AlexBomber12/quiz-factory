#!/usr/bin/env node
/* global __dirname, console, process, require */
"use strict";

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const ROOT_DIR = path.resolve(__dirname, "../../..");
const TENANTS_PATH = path.join(ROOT_DIR, "config/tenants.json");
const ALLOWED_LOCALES = new Set(["en", "es", "pt-BR"]);

const usage = () => {
  console.log(
    [
      "Usage:",
      "  node apps/web/scripts/tenants-db-import-file.js",
      "",
      "Environment:",
      "  CONTENT_DATABASE_URL=postgres://..."
    ].join("\n")
  );
};

const ensureDatabaseUrl = () => {
  const connectionString = process.env.CONTENT_DATABASE_URL;
  if (!connectionString) {
    throw new Error("CONTENT_DATABASE_URL is required to import tenants into the DB.");
  }

  return connectionString;
};

const normalizeNonEmptyString = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeLocale = (value) => {
  const normalized = normalizeNonEmptyString(value);
  if (!normalized) {
    return "en";
  }

  if (normalized.toLowerCase() === "pt-br") {
    return "pt-BR";
  }

  if (normalized.toLowerCase() === "en") {
    return "en";
  }

  if (normalized.toLowerCase() === "es") {
    return "es";
  }

  return null;
};

const normalizeDomain = (value) => {
  const normalized = normalizeNonEmptyString(value);
  if (!normalized) {
    return null;
  }

  if (normalized.includes("://") || normalized.includes("/") || /\s/.test(normalized)) {
    return null;
  }

  return normalized.toLowerCase();
};

const readTenantRecords = () => {
  if (!fs.existsSync(TENANTS_PATH)) {
    throw new Error(`tenants.json not found: ${TENANTS_PATH}`);
  }

  const parsed = JSON.parse(fs.readFileSync(TENANTS_PATH, "utf8"));
  const sourceTenants = Array.isArray(parsed?.tenants) ? parsed.tenants : [];

  const warnings = [];
  const records = [];

  for (const entry of sourceTenants) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      warnings.push("Skipping tenants.json entry: must be an object.");
      continue;
    }

    const tenantId = normalizeNonEmptyString(entry.tenant_id);
    if (!tenantId) {
      warnings.push("Skipping tenants.json entry: tenant_id is required.");
      continue;
    }

    const defaultLocale = normalizeLocale(entry.default_locale);
    if (!defaultLocale || !ALLOWED_LOCALES.has(defaultLocale)) {
      warnings.push(`Skipping ${tenantId}: default_locale must be one of en, es, pt-BR.`);
      continue;
    }

    const enabled = typeof entry.enabled === "boolean" ? entry.enabled : true;

    const rawDomains = Array.isArray(entry.domains) ? entry.domains : [];
    const domains = Array.from(
      new Set(
        rawDomains
          .map((domain) => normalizeDomain(domain))
          .filter((domain) => domain !== null)
      )
    ).sort((left, right) => left.localeCompare(right));

    if (domains.length === 0) {
      warnings.push(`Skipping ${tenantId}: at least one domain is required.`);
      continue;
    }

    records.push({
      tenantId,
      defaultLocale,
      enabled,
      domains
    });
  }

  records.sort((left, right) => left.tenantId.localeCompare(right.tenantId));

  return {
    records,
    warnings
  };
};

const syncTenant = async (client, record) => {
  await client.query(
    `
      INSERT INTO tenants (
        tenant_id,
        default_locale,
        enabled
      )
      VALUES ($1, $2, $3)
      ON CONFLICT (tenant_id)
      DO UPDATE SET
        default_locale = EXCLUDED.default_locale,
        enabled = EXCLUDED.enabled
    `,
    [record.tenantId, record.defaultLocale, record.enabled]
  );

  await client.query(
    `
      INSERT INTO tenant_domains (
        tenant_id,
        domain
      )
      SELECT
        $1::text AS tenant_id,
        domain_value
      FROM unnest($2::text[]) AS domain_value
      ON CONFLICT (domain)
      DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id
    `,
    [record.tenantId, record.domains]
  );

  await client.query(
    `
      DELETE FROM tenant_domains
      WHERE tenant_id = $1
        AND NOT (domain = ANY($2::text[]))
    `,
    [record.tenantId, record.domains]
  );
};

const run = async () => {
  const { records, warnings } = readTenantRecords();

  for (const warning of warnings) {
    console.warn(warning);
  }

  if (records.length === 0) {
    console.log("No valid tenant records found in config/tenants.json.");
    return;
  }

  const pool = new Pool({ connectionString: ensureDatabaseUrl() });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const record of records) {
      await syncTenant(client, record);
    }

    await client.query("COMMIT");
    console.log(`Imported ${records.length} tenant records into tenants/tenant_domains.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

if (process.argv.includes("-h") || process.argv.includes("--help")) {
  usage();
  process.exit(0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

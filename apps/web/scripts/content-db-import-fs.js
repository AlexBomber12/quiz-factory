#!/usr/bin/env node
/* global __dirname, console, process, require */
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const ROOT_DIR = path.resolve(__dirname, "../../..");
const TESTS_ROOT = path.join(ROOT_DIR, "content/tests");
const CATALOG_PATH = path.join(ROOT_DIR, "config/catalog.json");
const MIGRATION_ACTOR = "migration-fs-to-db";
const LOCALE_CANONICAL = {
  en: "en",
  es: "es",
  "pt-br": "pt-BR"
};

const usage = () => {
  console.log(
    [
      "Usage:",
      "  node apps/web/scripts/content-db-import-fs.js",
      "",
      "Environment:",
      "  CONTENT_DATABASE_URL=postgres://..."
    ].join("\n")
  );
};

const ensureDatabaseUrl = () => {
  const connectionString = process.env.CONTENT_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "CONTENT_DATABASE_URL is required to run the filesystem-to-DB content migration."
    );
  }
  return connectionString;
};

const normalizeNonEmptyString = (value) => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const normalizeLocaleTag = (value) => {
  const normalized = normalizeNonEmptyString(value);
  if (!normalized) {
    return null;
  }

  return LOCALE_CANONICAL[normalized.toLowerCase()] ?? null;
};

const isObjectRecord = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const canonicalizeJsonValue = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeJsonValue(item));
  }

  if (!isObjectRecord(value)) {
    return value;
  }

  const canonical = {};
  const keys = Object.keys(value).sort((left, right) => left.localeCompare(right));
  for (const key of keys) {
    canonical[key] = canonicalizeJsonValue(value[key]);
  }
  return canonical;
};

const computeChecksum = (value) => {
  const canonical = canonicalizeJsonValue(value);
  const payload = JSON.stringify(canonical);
  return crypto.createHash("sha256").update(payload, "utf8").digest("hex");
};

const readJsonFile = (filePath, label) => {
  const raw = fs.readFileSync(filePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
};

const resolveDefaultLocale = (locales, testId) => {
  if (!isObjectRecord(locales)) {
    throw new Error(`Skipping ${testId}: locales must be an object.`);
  }

  if (isObjectRecord(locales.en)) {
    return "en";
  }

  for (const localeKey of Object.keys(locales)) {
    const canonicalLocale = normalizeLocaleTag(localeKey);
    if (!canonicalLocale) {
      continue;
    }
    if (isObjectRecord(locales[canonicalLocale])) {
      return canonicalLocale;
    }
  }

  throw new Error(`Skipping ${testId}: locales has no supported keys.`);
};

const loadSpecRecords = () => {
  if (!fs.existsSync(TESTS_ROOT)) {
    throw new Error(`content/tests directory not found: ${TESTS_ROOT}`);
  }

  const skipped = [];
  const specs = [];
  const specFiles = fs
    .readdirSync(TESTS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(TESTS_ROOT, entry.name, "spec.json"))
    .filter((specPath) => fs.existsSync(specPath))
    .sort((left, right) => left.localeCompare(right));

  for (const specPath of specFiles) {
    const sourceLabel = path.relative(ROOT_DIR, specPath);
    let parsed;

    try {
      parsed = readJsonFile(specPath, sourceLabel);
    } catch (error) {
      skipped.push(error.message);
      continue;
    }

    if (!isObjectRecord(parsed)) {
      skipped.push(`Skipping ${sourceLabel}: spec root must be an object.`);
      continue;
    }

    const testId = normalizeNonEmptyString(parsed.test_id);
    const slug = normalizeNonEmptyString(parsed.slug);
    const version = parsed.version;

    if (!testId) {
      skipped.push(`Skipping ${sourceLabel}: missing test_id.`);
      continue;
    }

    if (!slug) {
      skipped.push(`Skipping ${sourceLabel}: missing slug.`);
      continue;
    }

    if (!Number.isInteger(version) || version < 1) {
      skipped.push(`Skipping ${testId}: version must be an integer >= 1.`);
      continue;
    }

    let defaultLocale;
    try {
      defaultLocale = resolveDefaultLocale(parsed.locales, testId);
    } catch (error) {
      skipped.push(error.message);
      continue;
    }

    specs.push({
      testId,
      slug,
      version,
      defaultLocale,
      spec: parsed,
      checksum: computeChecksum(parsed),
      sourceLabel
    });
  }

  return {
    specFilesFound: specFiles.length,
    specs,
    skipped
  };
};

const loadCatalogEntries = () => {
  if (!fs.existsSync(CATALOG_PATH)) {
    throw new Error(`catalog.json not found: ${CATALOG_PATH}`);
  }

  const skipped = [];
  const parsed = readJsonFile(CATALOG_PATH, "config/catalog.json");
  if (!isObjectRecord(parsed) || !isObjectRecord(parsed.tenants)) {
    throw new Error("config/catalog.json must contain a tenants object.");
  }

  const entries = [];
  const dedupe = new Set();
  const tenants = parsed.tenants;

  for (const tenantIdRaw of Object.keys(tenants)) {
    const tenantId = normalizeNonEmptyString(tenantIdRaw);
    const tests = tenants[tenantIdRaw];

    if (!tenantId) {
      skipped.push("Skipping catalog tenant entry with empty tenant_id.");
      continue;
    }
    if (!Array.isArray(tests)) {
      skipped.push(`Skipping tenant ${tenantId}: catalog value must be an array.`);
      continue;
    }

    for (const rawTestId of tests) {
      const testId = normalizeNonEmptyString(rawTestId);
      if (!testId) {
        skipped.push(`Skipping tenant ${tenantId}: empty test_id entry.`);
        continue;
      }
      const key = `${tenantId}::${testId}`;
      if (dedupe.has(key)) {
        continue;
      }
      dedupe.add(key);
      entries.push({
        tenantId,
        testId
      });
    }
  }

  entries.sort((left, right) => {
    const tenantCompare = left.tenantId.localeCompare(right.tenantId);
    if (tenantCompare !== 0) {
      return tenantCompare;
    }
    return left.testId.localeCompare(right.testId);
  });

  return {
    entries,
    skipped
  };
};

const findOrCreateTest = async (client, specRecord, summary) => {
  const { rows } = await client.query(
    `
      SELECT id, test_id, slug
      FROM tests
      WHERE test_id = $1 OR slug = $2
    `,
    [specRecord.testId, specRecord.slug]
  );

  const byTestId = rows.find((row) => row.test_id === specRecord.testId) ?? null;
  const bySlug = rows.find((row) => row.slug === specRecord.slug) ?? null;

  if (bySlug && bySlug.test_id !== specRecord.testId) {
    summary.skipped.push(
      `Skipping ${specRecord.testId}: slug '${specRecord.slug}' already belongs to ${bySlug.test_id}.`
    );
    return null;
  }

  if (byTestId && byTestId.slug !== specRecord.slug) {
    summary.skipped.push(
      `Skipping ${specRecord.testId}: existing test uses slug '${byTestId.slug}' (filesystem slug is '${specRecord.slug}').`
    );
    return null;
  }

  if (byTestId) {
    summary.testsExisting += 1;
    return {
      id: byTestId.id
    };
  }

  const { rows: insertedRows } = await client.query(
    `
      INSERT INTO tests (
        test_id,
        slug,
        default_locale
      )
      VALUES ($1, $2, $3)
      RETURNING id
    `,
    [specRecord.testId, specRecord.slug, specRecord.defaultLocale]
  );

  const inserted = insertedRows[0];
  if (!inserted) {
    throw new Error(`Failed to create tests row for ${specRecord.testId}.`);
  }

  summary.testsInserted += 1;
  return {
    id: inserted.id
  };
};

const findOrCreateVersion = async (client, input, summary) => {
  const { testRowId, specRecord } = input;

  const { rows: byChecksumRows } = await client.query(
    `
      SELECT id
      FROM test_versions
      WHERE test_id = $1
        AND checksum = $2
      ORDER BY version DESC
      LIMIT 1
    `,
    [testRowId, specRecord.checksum]
  );

  const byChecksum = byChecksumRows[0];
  if (byChecksum) {
    summary.versionsExisting += 1;
    return {
      id: byChecksum.id
    };
  }

  let insertVersion = specRecord.version;

  const { rows: byVersionRows } = await client.query(
    `
      SELECT id
      FROM test_versions
      WHERE test_id = $1
        AND version = $2
      LIMIT 1
    `,
    [testRowId, insertVersion]
  );

  if (byVersionRows[0]) {
    const { rows: nextRows } = await client.query(
      `
        SELECT COALESCE(MAX(version), 0) + 1 AS next_version
        FROM test_versions
        WHERE test_id = $1
      `,
      [testRowId]
    );
    const nextVersion = Number(nextRows[0]?.next_version ?? 0);
    if (!Number.isInteger(nextVersion) || nextVersion < 1) {
      throw new Error(`Failed to compute next version for ${specRecord.testId}.`);
    }

    summary.skipped.push(
      `Version ${specRecord.version} already existed for ${specRecord.testId}; inserted checksum as version ${nextVersion}.`
    );
    insertVersion = nextVersion;
  }

  const { rows: insertedRows } = await client.query(
    `
      INSERT INTO test_versions (
        test_id,
        version,
        status,
        spec_json,
        checksum,
        created_by
      )
      VALUES ($1, $2, 'draft', $3::jsonb, $4, $5)
      RETURNING id
    `,
    [
      testRowId,
      insertVersion,
      JSON.stringify(specRecord.spec),
      specRecord.checksum,
      MIGRATION_ACTOR
    ]
  );

  const inserted = insertedRows[0];
  if (!inserted) {
    throw new Error(`Failed to create version row for ${specRecord.testId}.`);
  }

  summary.versionsInserted += 1;
  return {
    id: inserted.id
  };
};

const resolveLatestPublishedVersion = async (client, testId) => {
  const { rows } = await client.query(
    `
      SELECT
        t.id AS test_row_id,
        tv.id AS version_id
      FROM tests t
      JOIN test_versions tv
        ON tv.test_id = t.id
      WHERE t.test_id = $1
      ORDER BY tv.version DESC
      LIMIT 1
    `,
    [testId]
  );

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    testRowId: row.test_row_id,
    versionId: row.version_id
  };
};

const upsertTenantPublishedVersion = async (client, input, summary) => {
  const { tenantId, testRowId, versionId } = input;
  const { rows: existingRows } = await client.query(
    `
      SELECT
        dp.published_version_id,
        dp.enabled
      FROM domain_publications dp
      JOIN content_items ci
        ON ci.id = dp.content_item_id
      JOIN tests t
        ON t.test_id = ci.content_key
      WHERE dp.tenant_id = $1
        AND ci.content_type = 'test'
        AND t.id = $2::uuid
      LIMIT 1
    `,
    [tenantId, testRowId]
  );

  const existing = existingRows[0] ?? null;

  await client.query(
    `
      WITH resolved_test AS (
        SELECT
          test_id,
          slug
        FROM tests
        WHERE id = $2::uuid
        LIMIT 1
      ),
      upsert_item AS (
        INSERT INTO content_items (
          content_type,
          content_key,
          slug
        )
        SELECT
          'test' AS content_type,
          resolved_test.test_id AS content_key,
          resolved_test.slug
        FROM resolved_test
        ON CONFLICT (content_type, content_key) DO UPDATE
        SET slug = EXCLUDED.slug
        RETURNING id
      ),
      resolved_item AS (
        SELECT id FROM upsert_item
        UNION ALL
        SELECT ci.id
        FROM content_items ci
        JOIN resolved_test
          ON ci.content_type = 'test'
          AND ci.content_key = resolved_test.test_id
        LIMIT 1
      )
      INSERT INTO domain_publications (
        tenant_id,
        content_item_id,
        published_version_id,
        enabled,
        published_at
      )
      SELECT
        $1,
        resolved_item.id,
        $3::uuid,
        TRUE,
        now()
      FROM resolved_item
      ON CONFLICT (tenant_id, content_item_id) DO UPDATE
      SET
        published_version_id = EXCLUDED.published_version_id,
        enabled = TRUE,
        published_at = CASE
          WHEN domain_publications.published_version_id IS DISTINCT FROM EXCLUDED.published_version_id
            OR domain_publications.enabled IS DISTINCT FROM TRUE
            OR domain_publications.published_at IS NULL
            THEN now()
          ELSE domain_publications.published_at
        END
    `,
    [tenantId, testRowId, versionId]
  );

  if (!existing) {
    summary.tenantMappingsInserted += 1;
    return;
  }

  if (existing.published_version_id === versionId && existing.enabled === true) {
    summary.tenantMappingsUnchanged += 1;
    return;
  }

  summary.tenantMappingsUpdated += 1;
};

const printSummary = (summary) => {
  console.log("Filesystem content migration completed.");
  console.log(`Specs found: ${summary.specFilesFound}`);
  console.log(`Specs imported: ${summary.specsImported}`);
  console.log(`Tests inserted: ${summary.testsInserted}`);
  console.log(`Tests existing: ${summary.testsExisting}`);
  console.log(`Versions inserted: ${summary.versionsInserted}`);
  console.log(`Versions existing: ${summary.versionsExisting}`);
  console.log(`Catalog entries: ${summary.catalogEntries}`);
  console.log(`Tenant mappings inserted: ${summary.tenantMappingsInserted}`);
  console.log(`Tenant mappings updated: ${summary.tenantMappingsUpdated}`);
  console.log(`Tenant mappings unchanged: ${summary.tenantMappingsUnchanged}`);
  if (summary.skipped.length > 0) {
    console.log(`Skipped items: ${summary.skipped.length}`);
    for (const message of summary.skipped) {
      console.log(`- ${message}`);
    }
  } else {
    console.log("Skipped items: 0");
  }
};

const run = async () => {
  const specResult = loadSpecRecords();
  const catalogResult = loadCatalogEntries();

  const summary = {
    specFilesFound: specResult.specFilesFound,
    specsImported: 0,
    testsInserted: 0,
    testsExisting: 0,
    versionsInserted: 0,
    versionsExisting: 0,
    catalogEntries: catalogResult.entries.length,
    tenantMappingsInserted: 0,
    tenantMappingsUpdated: 0,
    tenantMappingsUnchanged: 0,
    skipped: [...specResult.skipped, ...catalogResult.skipped]
  };

  const importedVersionsByTestId = new Map();
  const pool = new Pool({ connectionString: ensureDatabaseUrl() });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const specRecord of specResult.specs) {
      const testRow = await findOrCreateTest(client, specRecord, summary);
      if (!testRow) {
        continue;
      }

      const versionRow = await findOrCreateVersion(
        client,
        {
          testRowId: testRow.id,
          specRecord
        },
        summary
      );

      importedVersionsByTestId.set(specRecord.testId, {
        testRowId: testRow.id,
        versionId: versionRow.id
      });
      summary.specsImported += 1;
    }

    for (const entry of catalogResult.entries) {
      const imported = importedVersionsByTestId.get(entry.testId) ?? null;
      const mapping = imported ?? (await resolveLatestPublishedVersion(client, entry.testId));

      if (!mapping) {
        summary.skipped.push(
          `Skipping tenant mapping ${entry.tenantId} -> ${entry.testId}: no test/version found in DB.`
        );
        continue;
      }

      await upsertTenantPublishedVersion(
        client,
        {
          tenantId: entry.tenantId,
          testRowId: mapping.testRowId,
          versionId: mapping.versionId
        },
        summary
      );
    }

    await client.query("COMMIT");
    printSummary(summary);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  usage();
  process.exit(0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

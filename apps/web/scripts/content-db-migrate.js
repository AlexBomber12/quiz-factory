#!/usr/bin/env node
/* global __dirname, console, process, require */
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const MIGRATIONS_DIR = path.resolve(
  __dirname,
  "../src/lib/content_db/migrations"
);

const ensureDatabaseUrl = () => {
  const connectionString = process.env.CONTENT_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "CONTENT_DATABASE_URL is required to run content DB migrations."
    );
  }
  return connectionString;
};

const readMigrations = () => {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => /^\d+.*\.sql$/.test(name))
    .sort((a, b) => a.localeCompare(b));
};

const hashMigration = (sql) =>
  crypto.createHash("sha256").update(sql).digest("hex");

const run = async () => {
  const migrations = readMigrations();
  if (migrations.length === 0) {
    console.log("No content DB migrations found.");
    return;
  }

  const pool = new Pool({ connectionString: ensureDatabaseUrl() });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS applied_migrations (
        name text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await client.query(
      "SELECT name, checksum FROM applied_migrations"
    );
    const applied = new Map(rows.map((row) => [row.name, row.checksum]));

    for (const migrationName of migrations) {
      const migrationPath = path.join(MIGRATIONS_DIR, migrationName);
      const migrationSql = fs.readFileSync(migrationPath, "utf8");
      const migrationChecksum = hashMigration(migrationSql);
      const appliedChecksum = applied.get(migrationName);

      if (appliedChecksum) {
        if (appliedChecksum !== migrationChecksum) {
          throw new Error(
            `Migration checksum mismatch for ${migrationName}. ` +
              "Restore the original file or create a new numbered migration."
          );
        }
        continue;
      }

      console.log(`Applying migration ${migrationName}`);
      await client.query(migrationSql);
      await client.query(
        "INSERT INTO applied_migrations (name, checksum) VALUES ($1, $2)",
        [migrationName, migrationChecksum]
      );
    }

    await client.query("COMMIT");
    console.log("Content DB migrations are up to date.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

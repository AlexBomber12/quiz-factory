import { env } from "@/lib/env";
import { Pool } from "pg";

let pool: Pool | null = null;

export const hasContentDatabaseUrl = (): boolean =>
  Boolean(env.CONTENT_DATABASE_URL);

export const getContentDbPool = (): Pool => {
  const connectionString = env.CONTENT_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "CONTENT_DATABASE_URL is required before using the content database."
    );
  }

  if (!pool) {
    pool = new Pool({ connectionString });
  }

  return pool;
};

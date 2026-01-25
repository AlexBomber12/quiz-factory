import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

import {
  readReportPdfCache,
  resolveReportPdfTemplateVersion,
  writeReportPdfCache
} from "./pdf_cache";

let cacheDir = "";

const buildCacheParts = () => ({
  tenantId: "tenant-test",
  testId: "test-focus",
  reportKey: "tenant-test:test-focus:session-123",
  locale: "en",
  reportTemplateVersion: resolveReportPdfTemplateVersion(1)
});

beforeEach(async () => {
  cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), "report-pdf-cache-"));
  process.env.REPORT_PDF_CACHE_DIR = cacheDir;
  process.env.REPORT_PDF_CACHE_TTL_SECONDS = "3600";
});

afterEach(async () => {
  delete process.env.REPORT_PDF_CACHE_DIR;
  delete process.env.REPORT_PDF_CACHE_TTL_SECONDS;
  if (cacheDir) {
    await fs.rm(cacheDir, { recursive: true, force: true });
  }
  cacheDir = "";
});

describe("report pdf cache", () => {
  it("writes and reads cached pdf buffers", async () => {
    const parts = buildCacheParts();
    const buffer = Buffer.from("pdf-data");

    await writeReportPdfCache(parts, buffer);
    const hit = await readReportPdfCache(parts);

    expect(hit).not.toBeNull();
    expect(hit?.buffer.equals(buffer)).toBe(true);
  });

  it("expires stale cache entries based on ttl", async () => {
    process.env.REPORT_PDF_CACHE_TTL_SECONDS = "1";
    const parts = buildCacheParts();
    const buffer = Buffer.from("pdf-stale");

    const cachePath = await writeReportPdfCache(parts, buffer);

    const staleDate = new Date(Date.now() - 5_000);
    await fs.utimes(cachePath, staleDate, staleDate);

    const hit = await readReportPdfCache(parts);
    expect(hit).toBeNull();

    let exists = true;
    try {
      await fs.stat(cachePath);
    } catch {
      exists = false;
    }

    expect(exists).toBe(false);
  });
});

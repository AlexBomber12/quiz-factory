import { env } from "@/lib/env";
import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { normalizeStringStrict, parsePositiveInt } from "@/lib/utils/strings";
import { logger } from "@/lib/logger";

const DEFAULT_CACHE_DIR = path.join(process.cwd(), ".cache", "report-pdf");
const DEFAULT_TTL_SECONDS = 60 * 60 * 24;
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;
const DEFAULT_TEMPLATE_VERSION = "1";

let lastCleanupAtMs = 0;

type CacheKeyParts = {
  tenantId: string;
  testId: string;
  reportKey: string;
  locale: string;
  reportTemplateVersion: string;
};

export type ReportPdfCacheHit = {
  buffer: Buffer;
  cachePath: string;
  ageSeconds: number;
};

export const resolveReportPdfCacheDir = (): string => {
  const fromEnv = normalizeStringStrict(env.REPORT_PDF_CACHE_DIR);
  return fromEnv ?? DEFAULT_CACHE_DIR;
};

export const resolveReportPdfCacheTtlSeconds = (): number => {
  const fromEnv = parsePositiveInt(env.REPORT_PDF_CACHE_TTL_SECONDS);
  return fromEnv ?? DEFAULT_TTL_SECONDS;
};

const resolveTemplateSeed = (): string => {
  const fromEnv = normalizeStringStrict(env.REPORT_PDF_TEMPLATE_VERSION);
  return fromEnv ?? DEFAULT_TEMPLATE_VERSION;
};

export const resolveReportPdfTemplateVersion = (specVersion: number): string => {
  const normalizedSpecVersion =
    typeof specVersion === "number" && Number.isFinite(specVersion) && specVersion > 0
      ? String(Math.floor(specVersion))
      : DEFAULT_TEMPLATE_VERSION;

  return `${resolveTemplateSeed()}-${normalizedSpecVersion}`;
};

const buildCacheKey = (parts: CacheKeyParts): string => {
  return [
    `tenant:${parts.tenantId}`,
    `test:${parts.testId}`,
    `report:${parts.reportKey}`,
    `locale:${parts.locale}`,
    `template:${parts.reportTemplateVersion}`
  ].join("|");
};

const hashKey = (value: string): string => {
  return createHash("sha256").update(value).digest("hex");
};

const resolveCachePath = (parts: CacheKeyParts): string => {
  const dir = resolveReportPdfCacheDir();
  const cacheKey = buildCacheKey(parts);
  const filename = `${hashKey(cacheKey)}.pdf`;
  return path.join(dir, filename);
};

const ensureCacheDir = async (): Promise<string> => {
  const dir = resolveReportPdfCacheDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
};

const isExpired = (mtimeMs: number, nowMs: number, ttlMs: number): boolean => {
  return nowMs - mtimeMs > ttlMs;
};

const safeUnlink = async (filePath: string): Promise<void> => {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    logger.warn({ error }, "lib/report/pdf_cache.ts fallback handling failed");
    // Best-effort cleanup.
  }
};

const shouldRunCleanup = (nowMs: number): boolean => {
  if (nowMs - lastCleanupAtMs < CLEANUP_INTERVAL_MS) {
    return false;
  }

  lastCleanupAtMs = nowMs;
  return true;
};

export const cleanupExpiredCacheEntries = async (): Promise<void> => {
  const nowMs = Date.now();
  if (!shouldRunCleanup(nowMs)) {
    return;
  }

  const dir = resolveReportPdfCacheDir();
  const ttlMs = resolveReportPdfCacheTtlSeconds() * 1000;

  let entries: string[] = [];
  try {
    entries = await fs.readdir(dir);
  } catch (error) {
    logger.warn({ error }, "lib/report/pdf_cache.ts fallback handling failed");
    return;
  }

  await Promise.all(
    entries
      .filter((entry) => entry.endsWith(".pdf"))
      .map(async (entry) => {
        const filePath = path.join(dir, entry);
        try {
          const stat = await fs.stat(filePath);
          if (isExpired(stat.mtimeMs, nowMs, ttlMs)) {
            await safeUnlink(filePath);
          }
        } catch (error) {
          logger.warn({ error }, "lib/report/pdf_cache.ts fallback handling failed");
          // Ignore missing or unreadable entries.
        }
      })
  );
};

type ReadCacheOptions = CacheKeyParts;

export const readReportPdfCache = async (
  parts: ReadCacheOptions
): Promise<ReportPdfCacheHit | null> => {
  const cachePath = resolveCachePath(parts);
  const ttlMs = resolveReportPdfCacheTtlSeconds() * 1000;
  const nowMs = Date.now();

  try {
    const stat = await fs.stat(cachePath);
    if (isExpired(stat.mtimeMs, nowMs, ttlMs)) {
      await safeUnlink(cachePath);
      return null;
    }

    const buffer = await fs.readFile(cachePath);
    const ageSeconds = Math.max(0, Math.floor((nowMs - stat.mtimeMs) / 1000));
    return { buffer, cachePath, ageSeconds };
  } catch (error) {
    logger.warn({ error }, "lib/report/pdf_cache.ts fallback handling failed");
    return null;
  }
};

type WriteCacheOptions = CacheKeyParts;

export const writeReportPdfCache = async (
  parts: WriteCacheOptions,
  buffer: Buffer
): Promise<string> => {
  const dir = await ensureCacheDir();
  const cachePath = resolveCachePath(parts);
  const tempPath = path.join(
    dir,
    `${path.basename(cachePath, ".pdf")}.${process.pid}.${Date.now()}.tmp`
  );

  await fs.writeFile(tempPath, buffer);
  await fs.rename(tempPath, cachePath);
  return cachePath;
};

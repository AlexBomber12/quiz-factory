import { createHash } from "node:crypto";

import { getContentDbPool } from "../content_db/pool";

type TimestampValue = Date | string;

export type ImportStatus = "uploaded" | "processed" | "failed";

export type ImportFileRecord = {
  filename: string;
  md: string;
  sha256: string;
};

export type ImportFilesJson = Record<string, ImportFileRecord>;

export type ImportRecord = {
  id: string;
  status: ImportStatus;
  files_json: ImportFilesJson;
  detected_meta: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  created_by: string | null;
};

export type ImportPreviewFile = {
  locale: string;
  filename: string;
  size_bytes: number;
  sha256: string;
  title_guess: string;
  excerpt: string;
};

export type ImportPreview = {
  files: ImportPreviewFile[];
  warnings: string[];
};

type ImportRow = {
  id: string;
  status: ImportStatus;
  files_json: unknown;
  detected_meta: unknown;
  error: string | null;
  created_at: TimestampValue;
  created_by: string | null;
};

const SOURCE_FILE_NAME_RE = /^source\.([A-Za-z]{2,8}(?:-[A-Za-z0-9]{2,8})*)\.md$/;
const SHA256_RE = /^[a-f0-9]{64}$/;
const IMPORT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUIRED_PREVIEW_LOCALES = ["en", "es", "pt-BR"] as const;
const EMPTY_MD_TITLE = "(empty markdown)";
const EMPTY_MD_EXCERPT = "(empty markdown)";

export const MAX_IMPORT_TOTAL_BYTES = 2_000_000;
export const MAX_IMPORT_FILES = 30;

const normalizeNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toIsoString = (value: TimestampValue): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const normalizeLocaleSubtag = (subtag: string, index: number): string => {
  if (index === 0) {
    return subtag.toLowerCase();
  }

  if (/^[A-Za-z]{2}$/.test(subtag)) {
    return subtag.toUpperCase();
  }

  if (/^[A-Za-z]{4}$/.test(subtag)) {
    const lowered = subtag.toLowerCase();
    return `${lowered.slice(0, 1).toUpperCase()}${lowered.slice(1)}`;
  }

  return subtag.toLowerCase();
};

const normalizeImportFileRecord = (
  locale: string,
  value: unknown
): ImportFileRecord => {
  if (!isObjectRecord(value)) {
    throw new Error(`files_json.${locale} must be an object.`);
  }

  const filename = normalizeNonEmptyString(value.filename);
  const md = typeof value.md === "string" ? value.md : null;
  const sha256 = normalizeNonEmptyString(value.sha256)?.toLowerCase() ?? null;

  if (!filename) {
    throw new Error(`files_json.${locale}.filename is required.`);
  }

  if (md === null) {
    throw new Error(`files_json.${locale}.md must be a string.`);
  }

  if (!sha256 || !SHA256_RE.test(sha256)) {
    throw new Error(`files_json.${locale}.sha256 must be a 64-char hex string.`);
  }

  return { filename, md, sha256 };
};

const normalizeImportFilesJson = (value: unknown): ImportFilesJson => {
  if (!isObjectRecord(value)) {
    throw new Error("files_json must be an object.");
  }

  const normalized: ImportFilesJson = {};
  for (const [locale, file] of Object.entries(value)) {
    const normalizedLocale = normalizeImportLocale(locale);
    if (!normalizedLocale) {
      throw new Error(`Invalid locale in files_json: ${locale}`);
    }

    normalized[normalizedLocale] = normalizeImportFileRecord(normalizedLocale, file);
  }

  return normalized;
};

const toImportRecord = (row: ImportRow): ImportRecord => {
  const detectedMeta = isObjectRecord(row.detected_meta) ? row.detected_meta : null;
  return {
    id: row.id,
    status: row.status,
    files_json: normalizeImportFilesJson(row.files_json),
    detected_meta: detectedMeta,
    error: row.error,
    created_at: toIsoString(row.created_at),
    created_by: row.created_by
  };
};

export const normalizeImportLocale = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (!/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{2,8})*$/.test(trimmed)) {
    return null;
  }

  return trimmed
    .split("-")
    .map((subtag, index) => normalizeLocaleSubtag(subtag, index))
    .join("-");
};

export const parseImportLocaleFromFilename = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(SOURCE_FILE_NAME_RE);
  if (!match) {
    return null;
  }

  return normalizeImportLocale(match[1] ?? "");
};

export const hashMarkdown = (md: string): string => {
  return createHash("sha256").update(md, "utf8").digest("hex");
};

export const isValidImportId = (value: string): boolean => {
  return IMPORT_ID_RE.test(value.trim());
};

export const guessMarkdownTitle = (md: string): string => {
  const lines = md.replace(/\r\n/g, "\n").split("\n");

  for (const line of lines) {
    const match = line.trim().match(/^#\s+(.+)$/);
    if (match) {
      const title = match[1]?.trim();
      if (title) {
        return title;
      }
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return EMPTY_MD_TITLE;
};

export const buildMarkdownExcerpt = (md: string, maxChars = 240): string => {
  const excerptLines = md
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 3);

  if (excerptLines.length === 0) {
    return EMPTY_MD_EXCERPT;
  }

  const excerpt = excerptLines.join("\n");
  if (excerpt.length <= maxChars) {
    return excerpt;
  }

  return `${excerpt.slice(0, maxChars - 1)}...`;
};

export const buildImportWarnings = (filesJson: ImportFilesJson): string[] => {
  const warnings: string[] = [];
  const locales = Object.keys(filesJson).sort((left, right) => left.localeCompare(right));

  const missingRequired = REQUIRED_PREVIEW_LOCALES.filter(
    (locale) => !locales.includes(locale)
  );
  if (missingRequired.length > 0) {
    warnings.push(`Missing required locales: ${missingRequired.join(", ")}.`);
  }

  const localesByHash = new Map<string, string[]>();
  for (const locale of locales) {
    const record = filesJson[locale];
    if (!record) {
      continue;
    }

    const existing = localesByHash.get(record.sha256) ?? [];
    existing.push(locale);
    localesByHash.set(record.sha256, existing);
  }

  for (const [sha256, hashLocales] of localesByHash.entries()) {
    if (hashLocales.length <= 1) {
      continue;
    }

    warnings.push(
      `Duplicate markdown hash ${sha256} across locales: ${hashLocales.join(", ")}.`
    );
  }

  return warnings;
};

export const buildImportPreview = (filesJson: ImportFilesJson): ImportPreview => {
  const files = Object.entries(filesJson)
    .sort(([leftLocale], [rightLocale]) => leftLocale.localeCompare(rightLocale))
    .map(([locale, value]) => ({
      locale,
      filename: value.filename,
      size_bytes: Buffer.byteLength(value.md, "utf8"),
      sha256: value.sha256,
      title_guess: guessMarkdownTitle(value.md),
      excerpt: buildMarkdownExcerpt(value.md)
    }));

  return {
    files,
    warnings: buildImportWarnings(filesJson)
  };
};

export const createUploadedImport = async (input: {
  files_json: ImportFilesJson;
  created_by?: string | null;
}): Promise<ImportRecord> => {
  const filesJson = normalizeImportFilesJson(input.files_json);
  const createdBy = normalizeNonEmptyString(input.created_by ?? null);
  const pool = getContentDbPool();

  const { rows } = await pool.query<ImportRow>(
    `
      INSERT INTO imports (
        status,
        files_json,
        created_by
      )
      VALUES ('uploaded', $1::jsonb, $2)
      RETURNING
        id,
        status,
        files_json,
        detected_meta,
        error,
        created_at,
        created_by
    `,
    [JSON.stringify(filesJson), createdBy]
  );

  const row = rows[0];
  if (!row) {
    throw new Error("Failed to create import row.");
  }

  return toImportRecord(row);
};

export const getImportById = async (importId: string): Promise<ImportRecord | null> => {
  const normalizedImportId = normalizeNonEmptyString(importId);
  if (!normalizedImportId || !isValidImportId(normalizedImportId)) {
    return null;
  }

  const pool = getContentDbPool();
  const { rows } = await pool.query<ImportRow>(
    `
      SELECT
        id,
        status,
        files_json,
        detected_meta,
        error,
        created_at,
        created_by
      FROM imports
      WHERE id = $1
      LIMIT 1
    `,
    [normalizedImportId]
  );

  const row = rows[0];
  if (!row) {
    return null;
  }

  return toImportRecord(row);
};

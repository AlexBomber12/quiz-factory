import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import type { PoolClient } from "pg";

import { validateTestSpec } from "../content/validate";
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

export type ImportDraftStatus = "draft" | "archived";

export type ImportDraftRecord = {
  id: string;
  test_id: string;
  slug: string;
  default_locale: string;
  version: number;
  status: ImportDraftStatus;
  spec_json: unknown;
  source_import_id: string | null;
  checksum: string;
  created_at: string;
  created_by: string | null;
};

export type ConvertImportToDraftResult = {
  import: ImportRecord;
  draft: ImportDraftRecord;
  created: boolean;
};

export type ImportConversionErrorCode =
  | "invalid_import_id"
  | "import_not_found"
  | "unsupported_format"
  | "conversion_failed"
  | "validation_failed"
  | "slug_conflict"
  | "test_conflict"
  | "db_error";

export class ImportConversionError extends Error {
  code: ImportConversionErrorCode;
  status: number;
  detail: string | null;
  preserve_import_status: boolean;

  constructor(input: {
    code: ImportConversionErrorCode;
    status: number;
    detail?: string | null;
    preserve_import_status?: boolean;
  }) {
    super(input.detail ?? input.code);
    this.name = "ImportConversionError";
    this.code = input.code;
    this.status = input.status;
    this.detail = input.detail ?? null;
    this.preserve_import_status = Boolean(input.preserve_import_status);
  }
}

type ImportRow = {
  id: string;
  status: ImportStatus;
  files_json: unknown;
  detected_meta: unknown;
  error: string | null;
  created_at: TimestampValue;
  created_by: string | null;
};

type TestRow = {
  id: string;
  test_id: string;
  slug: string;
  default_locale: string;
  created_at: TimestampValue;
  updated_at: TimestampValue;
};

type DraftRow = {
  id: string;
  test_id: string;
  slug: string;
  default_locale: string;
  version: number;
  status: ImportDraftStatus;
  spec_json: unknown;
  source_import_id: string | null;
  checksum: string;
  created_at: TimestampValue;
  created_by: string | null;
};

type ParsedFrontMatter = {
  meta: Record<string, string>;
  lines: string[];
  end_line_index: number;
  body: string;
};

type ConversionMetadata = {
  format_id: "universal_human_v1";
  test_id: string;
  slug: string;
  en_title: string;
};

type ConverterError = Error & {
  code?: string | number;
  killed?: boolean;
  signal?: string | null;
  stderr?: string;
};

type PgError = Error & {
  code?: string;
};

const SOURCE_FILE_NAME_RE = /^source\.([A-Za-z]{2,8}(?:-[A-Za-z0-9]{2,8})*)\.md$/;
const SHA256_RE = /^[a-f0-9]{64}$/;
const IMPORT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUIRED_PREVIEW_LOCALES = ["en", "es", "pt-BR"] as const;
const EMPTY_MD_TITLE = "(empty markdown)";
const EMPTY_MD_EXCERPT = "(empty markdown)";
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TEST_ID_RE = /^test-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FRONT_MATTER_DELIMITER = "---";
const UNIVERSAL_FORMAT_ID = "universal_human_v1";
const MAX_CONVERTER_STDERR_CHARS = 1_200;
const CONVERTER_TIMEOUT_MS = 15_000;
const MAX_IMPORT_ERROR_CHARS = 1_500;
const MAX_CONVERTED_SPEC_BYTES = 2_000_000;
const LIKERT_LEVELS = 5;
const execFileAsync = promisify(execFile);

const LIKERT_OPTION_LABELS: Record<string, string[]> = {
  en: ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"],
  es: ["Muy en desacuerdo", "En desacuerdo", "Neutral", "De acuerdo", "Muy de acuerdo"],
  "pt-BR": ["Discordo totalmente", "Discordo", "Neutro", "Concordo", "Concordo totalmente"]
};

const BAND_COPY: Record<
  "low" | "mid" | "high",
  { headline: string; summary: string; bullets: string[] }
> = {
  low: {
    headline: "Grounded profile",
    summary: "You are building a stable baseline and can improve with steady repetition.",
    bullets: [
      "Focus on consistent daily practice.",
      "Track small gains week by week.",
      "Use clear routines to keep momentum."
    ]
  },
  mid: {
    headline: "Balanced profile",
    summary: "You show a balanced pattern with room to sharpen strengths in key moments.",
    bullets: [
      "Keep what is working and remove friction.",
      "Use checkpoints to stay aligned.",
      "Prioritize one improvement at a time."
    ]
  },
  high: {
    headline: "Advanced profile",
    summary: "You demonstrate strong consistency and can optimize for higher impact.",
    bullets: [
      "Protect your strongest habits.",
      "Scale what delivers results fastest.",
      "Mentor others to reinforce your own system."
    ]
  }
};

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

const toImportDraftRecord = (row: DraftRow): ImportDraftRecord => {
  return {
    id: row.id,
    test_id: row.test_id,
    slug: row.slug,
    default_locale: row.default_locale,
    version: row.version,
    status: row.status,
    spec_json: row.spec_json,
    source_import_id: row.source_import_id,
    checksum: row.checksum,
    created_at: toIsoString(row.created_at),
    created_by: row.created_by
  };
};

const parseFrontMatter = (markdown: string): ParsedFrontMatter | null => {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  if (lines[0]?.trim() !== FRONT_MATTER_DELIMITER) {
    return null;
  }

  let endLineIndex = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index]?.trim() === FRONT_MATTER_DELIMITER) {
      endLineIndex = index;
      break;
    }
  }

  if (endLineIndex < 0) {
    return null;
  }

  const meta: Record<string, string> = {};
  for (const line of lines.slice(1, endLineIndex)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf(":");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim().toLowerCase();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!key) {
      continue;
    }

    const unquoted =
      value.length >= 2 &&
      ((value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'")))
        ? value.slice(1, -1).trim()
        : value;

    meta[key] = unquoted;
  }

  return {
    meta,
    lines,
    end_line_index: endLineIndex,
    body: lines.slice(endLineIndex + 1).join("\n")
  };
};

const frontMatterKeyFromLine = (line: string): string | null => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const separatorIndex = trimmed.indexOf(":");
  if (separatorIndex <= 0) {
    return null;
  }

  return trimmed.slice(0, separatorIndex).trim().toLowerCase() || null;
};

const ensureFrontMatterKeys = (
  markdown: string,
  keys: Record<string, string>
): string => {
  const parsed = parseFrontMatter(markdown);
  const normalized = markdown.replace(/\r\n/g, "\n");
  if (!parsed) {
    return normalized;
  }

  const existingKeys = new Set(
    parsed.lines
      .slice(1, parsed.end_line_index)
      .map((line) => frontMatterKeyFromLine(line))
      .filter((value): value is string => value !== null)
  );

  const additions: string[] = [];
  for (const [key, value] of Object.entries(keys)) {
    const normalizedKey = key.trim().toLowerCase();
    if (!normalizedKey || existingKeys.has(normalizedKey)) {
      continue;
    }
    additions.push(`${normalizedKey}: ${value}`);
  }

  if (additions.length === 0) {
    return normalized;
  }

  const updatedLines = [
    ...parsed.lines.slice(0, parsed.end_line_index),
    ...additions,
    ...parsed.lines.slice(parsed.end_line_index)
  ];

  return updatedLines.join("\n");
};

const slugify = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-");
};

const sanitizeProcessDetail = (value: string | null | undefined): string | null => {
  const normalized = normalizeNonEmptyString(value);
  if (!normalized) {
    return null;
  }

  const collapsed = normalized
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join(" | ");

  if (!collapsed) {
    return null;
  }

  if (collapsed.length <= MAX_CONVERTER_STDERR_CHARS) {
    return collapsed;
  }

  return `${collapsed.slice(0, MAX_CONVERTER_STDERR_CHARS - 3)}...`;
};

const sanitizeImportError = (value: string): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= MAX_IMPORT_ERROR_CHARS) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_IMPORT_ERROR_CHARS - 3)}...`;
};

const asImportConversionError = (error: unknown): ImportConversionError => {
  if (error instanceof ImportConversionError) {
    return error;
  }

  const fallbackMessage = error instanceof Error ? error.message : String(error);
  return new ImportConversionError({
    code: "db_error",
    status: 500,
    detail: sanitizeImportError(`Import conversion failed: ${fallbackMessage}`)
  });
};

const failValidation = (detail: string): never => {
  throw new ImportConversionError({
    code: "validation_failed",
    status: 422,
    detail
  });
};

const requireRecord = (value: unknown, pathLabel: string): Record<string, unknown> => {
  if (!isObjectRecord(value)) {
    failValidation(`${pathLabel} must be an object.`);
  }

  return value as Record<string, unknown>;
};

const requireArray = (value: unknown, pathLabel: string): unknown[] => {
  if (!Array.isArray(value)) {
    failValidation(`${pathLabel} must be an array.`);
  }

  return value as unknown[];
};

const requireString = (value: unknown, pathLabel: string): string => {
  const normalized = normalizeNonEmptyString(value);
  if (!normalized) {
    failValidation(`${pathLabel} must be a non-empty string.`);
  }

  return normalized ?? "";
};

const requireInteger = (value: unknown, pathLabel: string): number => {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    failValidation(`${pathLabel} must be an integer.`);
  }

  return value as number;
};

const canonicalizeJsonValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeJsonValue(item));
  }

  if (!isObjectRecord(value)) {
    return value;
  }

  const sortedKeys = Object.keys(value).sort((left, right) => left.localeCompare(right));
  const canonical: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    canonical[key] = canonicalizeJsonValue(value[key]);
  }

  return canonical;
};

export const computeCanonicalJsonSha256 = (
  value: unknown
): { canonical: unknown; checksum: string } => {
  const canonical = canonicalizeJsonValue(value);
  const serialized = JSON.stringify(canonical);
  const checksum = createHash("sha256").update(serialized, "utf8").digest("hex");
  return { canonical, checksum };
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

export const getDraftByImportId = async (
  importId: string
): Promise<ImportDraftRecord | null> => {
  const normalizedImportId = normalizeNonEmptyString(importId);
  if (!normalizedImportId || !isValidImportId(normalizedImportId)) {
    return null;
  }

  const pool = getContentDbPool();
  const { rows } = await pool.query<DraftRow>(
    `
      SELECT
        tv.id,
        t.test_id,
        t.slug,
        t.default_locale,
        tv.version,
        tv.status,
        tv.spec_json,
        tv.source_import_id,
        tv.checksum,
        tv.created_at,
        tv.created_by
      FROM test_versions tv
      JOIN tests t
        ON t.id = tv.test_id
      WHERE tv.source_import_id = $1
      ORDER BY tv.version DESC
      LIMIT 1
    `,
    [normalizedImportId]
  );

  const row = rows[0];
  if (!row) {
    return null;
  }

  return toImportDraftRecord(row);
};

export const resolveConversionMetadata = (
  filesJson: ImportFilesJson
): ConversionMetadata => {
  const enFile = filesJson.en;
  if (!enFile) {
    throw new ImportConversionError({
      code: "unsupported_format",
      status: 422,
      detail: "source.en.md is required to detect format_id.",
      preserve_import_status: true
    });
  }

  const frontMatter = parseFrontMatter(enFile.md);
  if (!frontMatter) {
    throw new ImportConversionError({
      code: "unsupported_format",
      status: 422,
      detail: "source.en.md must include YAML front matter with format_id.",
      preserve_import_status: true
    });
  }

  const formatId = normalizeNonEmptyString(frontMatter.meta.format_id);
  if (formatId !== UNIVERSAL_FORMAT_ID) {
    throw new ImportConversionError({
      code: "unsupported_format",
      status: 422,
      detail: `Unsupported format_id in source.en.md: ${formatId ?? "missing"}. Expected ${UNIVERSAL_FORMAT_ID}.`,
      preserve_import_status: true
    });
  }

  const fmTestId = normalizeNonEmptyString(frontMatter.meta.test_id);
  const fmSlug = normalizeNonEmptyString(frontMatter.meta.slug);

  let testId = fmTestId;
  let slug = fmSlug;

  if (!testId && !slug) {
    const titleGuess = guessMarkdownTitle(frontMatter.body);
    if (titleGuess === EMPTY_MD_TITLE) {
      throw new ImportConversionError({
        code: "validation_failed",
        status: 422,
        detail: "Cannot derive slug because source.en.md title is empty."
      });
    }

    const derivedSlug = slugify(titleGuess);
    if (!derivedSlug) {
      throw new ImportConversionError({
        code: "validation_failed",
        status: 422,
        detail: "Cannot derive a valid slug from source.en.md title."
      });
    }

    slug = derivedSlug;
    testId = `test-${derivedSlug}`;
  } else if (testId && !slug) {
    slug = testId.startsWith("test-") ? testId.slice("test-".length) : "";
  } else if (!testId && slug) {
    testId = `test-${slug}`;
  }

  if (!slug || !SLUG_RE.test(slug)) {
    throw new ImportConversionError({
      code: "validation_failed",
      status: 422,
      detail: `Invalid slug '${slug ?? ""}'. Slug must be URL-safe.`
    });
  }

  if (!testId || !TEST_ID_RE.test(testId)) {
    throw new ImportConversionError({
      code: "validation_failed",
      status: 422,
      detail: `Invalid test_id '${testId ?? ""}'. test_id must match test-<slug>.`
    });
  }

  if (testId !== `test-${slug}`) {
    throw new ImportConversionError({
      code: "validation_failed",
      status: 422,
      detail: "test_id must align with slug."
    });
  }

  return {
    format_id: UNIVERSAL_FORMAT_ID,
    test_id: testId,
    slug,
    en_title: guessMarkdownTitle(frontMatter.body)
  };
};

const enforceConversionSizeLimits = (filesJson: ImportFilesJson): void => {
  const locales = Object.keys(filesJson);
  if (locales.length === 0) {
    throw new ImportConversionError({
      code: "conversion_failed",
      status: 422,
      detail: "Import contains no files."
    });
  }

  if (locales.length > MAX_IMPORT_FILES) {
    throw new ImportConversionError({
      code: "conversion_failed",
      status: 422,
      detail: `Import exceeds max file count (${MAX_IMPORT_FILES}).`
    });
  }

  let totalBytes = 0;
  for (const locale of locales) {
    const file = filesJson[locale];
    if (!file) {
      continue;
    }

    totalBytes += Buffer.byteLength(file.md, "utf8");
    if (totalBytes > MAX_IMPORT_TOTAL_BYTES) {
      throw new ImportConversionError({
        code: "conversion_failed",
        status: 422,
        detail: `Import exceeds max total bytes (${MAX_IMPORT_TOTAL_BYTES}).`
      });
    }
  }
};

const resolveRepoRootForConverter = (): string => {
  const cwd = process.cwd();
  const candidates = [
    cwd,
    path.resolve(cwd, ".."),
    path.resolve(cwd, "..", ".."),
    path.resolve(cwd, "..", "..", "..")
  ];

  for (const candidate of candidates) {
    const scriptPath = path.join(candidate, "scripts", "content", "universal_human_md_to_spec.py");
    if (existsSync(scriptPath)) {
      return candidate;
    }
  }

  throw new ImportConversionError({
    code: "conversion_failed",
    status: 500,
    detail: "Unable to locate scripts/content/universal_human_md_to_spec.py."
  });
};

const runUniversalConverter = async (
  sourceDir: string,
  outPath: string
): Promise<void> => {
  const repoRoot = resolveRepoRootForConverter();
  const scriptPath = path.join(repoRoot, "scripts", "content", "universal_human_md_to_spec.py");

  try {
    await execFileAsync(
      "python3",
      [scriptPath, "--source-dir", sourceDir, "--out", outPath],
      {
        cwd: repoRoot,
        timeout: CONVERTER_TIMEOUT_MS,
        maxBuffer: 1_048_576
      }
    );
  } catch (error) {
    const typedError = error as ConverterError;
    const isTimeout =
      typedError.code === "ETIMEDOUT" ||
      (typedError.killed === true && typedError.signal === "SIGTERM");

    if (isTimeout) {
      throw new ImportConversionError({
        code: "conversion_failed",
        status: 422,
        detail: `Converter timed out after ${CONVERTER_TIMEOUT_MS}ms.`
      });
    }

    const stderr = sanitizeProcessDetail(typedError.stderr);
    throw new ImportConversionError({
      code: "conversion_failed",
      status: 422,
      detail: stderr ? `Converter failed: ${stderr}` : "Converter failed."
    });
  }
};

export const normalizeUniversalSpecForValidation = (
  rawSpec: unknown,
  metadata: ConversionMetadata
): unknown => {
  const spec = requireRecord(rawSpec, "spec");

  const convertedTestId = requireString(spec.test_id, "spec.test_id");
  const convertedSlug = requireString(spec.slug, "spec.slug");
  if (convertedTestId !== metadata.test_id) {
    failValidation(
      `Converted spec test_id '${convertedTestId}' does not match expected '${metadata.test_id}'.`
    );
  }
  if (convertedSlug !== metadata.slug) {
    failValidation(
      `Converted spec slug '${convertedSlug}' does not match expected '${metadata.slug}'.`
    );
  }

  const version = requireInteger(spec.version, "spec.version");
  if (version < 1) {
    failValidation("spec.version must be >= 1.");
  }

  const category = requireString(spec.category, "spec.category");

  const localesRaw = requireRecord(spec.locales, "spec.locales");
  const locales: Record<string, Record<string, string>> = {};
  for (const locale of REQUIRED_PREVIEW_LOCALES) {
    const localeRaw = requireRecord(localesRaw[locale], `spec.locales.${locale}`);
    const title = requireString(localeRaw.title, `spec.locales.${locale}.title`);
    const shortDescription = requireString(
      localeRaw.short_description,
      `spec.locales.${locale}.short_description`
    );
    const intro = requireString(localeRaw.intro, `spec.locales.${locale}.intro`);
    const paywallHook = requireString(
      localeRaw.paywall_hook,
      `spec.locales.${locale}.paywall_hook`
    );

    locales[locale] = {
      title,
      short_description: shortDescription,
      intro,
      paywall_headline: paywallHook,
      report_title: `${title} Report`
    };
  }

  const scalesRaw = requireArray(spec.scales, "spec.scales");
  const scales: string[] = [];
  for (let index = 0; index < scalesRaw.length; index += 1) {
    const scale = requireString(scalesRaw[index], `spec.scales[${index}]`);
    if (!scales.includes(scale)) {
      scales.push(scale);
    }
  }

  if (scales.length === 0) {
    failValidation("spec.scales must include at least one scale.");
  }

  const questionsRaw = requireArray(spec.questions, "spec.questions");
  if (questionsRaw.length === 0) {
    failValidation("spec.questions must include at least one question.");
  }

  const optionWeights: Record<string, Record<string, number>> = {};
  const seenQuestionIds = new Set<string>();
  const questions = questionsRaw.map((question, index) => {
    const questionPath = `spec.questions[${index}]`;
    const rawQuestion = requireRecord(question, questionPath);
    const questionId = requireString(rawQuestion.question_id, `${questionPath}.question_id`);
    if (seenQuestionIds.has(questionId)) {
      failValidation(`${questionPath}.question_id must be unique.`);
    }
    seenQuestionIds.add(questionId);

    const scaleId = requireString(rawQuestion.scale_id, `${questionPath}.scale_id`);
    if (!scales.includes(scaleId)) {
      scales.push(scaleId);
    }

    const promptRaw = requireRecord(rawQuestion.prompt, `${questionPath}.prompt`);
    const prompt: Record<string, string> = {};
    for (const locale of REQUIRED_PREVIEW_LOCALES) {
      prompt[locale] = requireString(promptRaw[locale], `${questionPath}.prompt.${locale}`);
    }

    const options = Array.from({ length: LIKERT_LEVELS }, (_unused, optionIndex) => {
      const optionId = `${questionId}-opt-${optionIndex + 1}`;
      const label: Record<string, string> = {};
      for (const locale of REQUIRED_PREVIEW_LOCALES) {
        label[locale] =
          LIKERT_OPTION_LABELS[locale]?.[optionIndex] ??
          LIKERT_OPTION_LABELS.en[optionIndex] ??
          `Option ${optionIndex + 1}`;
      }

      optionWeights[optionId] = {
        [scaleId]: optionIndex + 1
      };

      return {
        id: optionId,
        label
      };
    });

    return {
      id: questionId,
      type: "single_choice" as const,
      prompt,
      options
    };
  });

  const minScore = questions.length;
  const maxScore = questions.length * LIKERT_LEVELS;
  const scoreSpan = maxScore - minScore + 1;
  const lowSize = Math.ceil(scoreSpan / 3);
  const midSize = Math.ceil((scoreSpan - lowSize) / 2);
  const lowMax = minScore + lowSize - 1;
  const midMax = lowMax + midSize;

  const buildBandCopyByKey = (
    key: "low" | "mid" | "high"
  ): Record<string, { headline: string; summary: string; bullets: string[] }> => {
    const copy: Record<string, { headline: string; summary: string; bullets: string[] }> = {};
    for (const locale of REQUIRED_PREVIEW_LOCALES) {
      copy[locale] = {
        headline: BAND_COPY[key].headline,
        summary: BAND_COPY[key].summary,
        bullets: [...BAND_COPY[key].bullets]
      };
    }
    return copy;
  };

  const resultBands = [
    {
      band_id: "low",
      min_score_inclusive: minScore,
      max_score_inclusive: lowMax,
      copy: buildBandCopyByKey("low")
    },
    {
      band_id: "mid",
      min_score_inclusive: lowMax + 1,
      max_score_inclusive: midMax,
      copy: buildBandCopyByKey("mid")
    },
    {
      band_id: "high",
      min_score_inclusive: midMax + 1,
      max_score_inclusive: maxScore,
      copy: buildBandCopyByKey("high")
    }
  ];

  // Keep result bands explicit and complete so validateTestSpec can enforce structure.
  if (resultBands.some((band) => band.min_score_inclusive > band.max_score_inclusive)) {
    failValidation("Result band boundaries are invalid.");
  }

  const normalizedSpec = {
    test_id: metadata.test_id,
    slug: metadata.slug,
    version,
    category,
    locales,
    questions,
    scoring: {
      scales,
      option_weights: optionWeights
    },
    result_bands: resultBands,
    _universal_source: {
      format_id: metadata.format_id
    }
  };

  return validateTestSpec(normalizedSpec, metadata.test_id);
};

const convertImportFilesToValidatedSpec = async (
  filesJson: ImportFilesJson,
  metadata: ConversionMetadata
): Promise<{ spec_json: unknown; checksum: string }> => {
  enforceConversionSizeLimits(filesJson);

  const tempDir = await mkdtemp(path.join(tmpdir(), "admin-import-"));
  const specPath = path.join(tempDir, "spec.json");

  try {
    const sortedLocales = Object.keys(filesJson).sort((left, right) => left.localeCompare(right));
    for (const locale of sortedLocales) {
      const file = filesJson[locale];
      if (!file) {
        continue;
      }

      const patchedMarkdown = ensureFrontMatterKeys(file.md, {
        test_id: metadata.test_id,
        slug: metadata.slug
      });

      const sourcePath = path.join(tempDir, `source.${locale}.md`);
      await writeFile(sourcePath, patchedMarkdown, "utf8");
    }

    await runUniversalConverter(tempDir, specPath);

    const rawSpec = await readFile(specPath, "utf8");
    if (Buffer.byteLength(rawSpec, "utf8") > MAX_CONVERTED_SPEC_BYTES) {
      throw new ImportConversionError({
        code: "conversion_failed",
        status: 422,
        detail: `Converted spec exceeds ${MAX_CONVERTED_SPEC_BYTES} bytes.`
      });
    }

    let parsedSpec: unknown;
    try {
      parsedSpec = JSON.parse(rawSpec);
    } catch {
      throw new ImportConversionError({
        code: "conversion_failed",
        status: 422,
        detail: "Converter produced invalid JSON spec."
      });
    }

    const validatedSpec = normalizeUniversalSpecForValidation(parsedSpec, metadata);
    const { canonical, checksum } = computeCanonicalJsonSha256(validatedSpec);
    return {
      spec_json: canonical,
      checksum
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};

const isUniqueViolation = (error: unknown): boolean => {
  return Boolean(error) && typeof error === "object" && (error as PgError).code === "23505";
};

const getOrCreateTest = async (
  client: PoolClient,
  identity: { test_id: string; slug: string }
): Promise<TestRow> => {
  const selectExisting = async (): Promise<TestRow[]> => {
    const { rows } = await client.query<TestRow>(
      `
        SELECT
          id,
          test_id,
          slug,
          default_locale,
          created_at,
          updated_at
        FROM tests
        WHERE test_id = $1
          OR slug = $2
      `,
      [identity.test_id, identity.slug]
    );

    return rows;
  };

  const existingRows = await selectExisting();
  const byTestId = existingRows.find((row) => row.test_id === identity.test_id) ?? null;
  const bySlug = existingRows.find((row) => row.slug === identity.slug) ?? null;

  if (bySlug && bySlug.test_id !== identity.test_id) {
    throw new ImportConversionError({
      code: "slug_conflict",
      status: 409,
      detail: `Slug '${identity.slug}' is already used by ${bySlug.test_id}.`
    });
  }

  if (byTestId) {
    if (byTestId.slug !== identity.slug) {
      throw new ImportConversionError({
        code: "test_conflict",
        status: 409,
        detail: `Test ${identity.test_id} already exists with slug '${byTestId.slug}'.`
      });
    }

    return byTestId;
  }

  try {
    const { rows } = await client.query<TestRow>(
      `
        INSERT INTO tests (
          test_id,
          slug,
          default_locale
        )
        VALUES ($1, $2, 'en')
        RETURNING
          id,
          test_id,
          slug,
          default_locale,
          created_at,
          updated_at
      `,
      [identity.test_id, identity.slug]
    );

    const inserted = rows[0];
    if (!inserted) {
      throw new ImportConversionError({
        code: "db_error",
        status: 500,
        detail: "Failed to create tests row."
      });
    }

    return inserted;
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }

    const latestRows = await selectExisting();
    const latestByTestId = latestRows.find((row) => row.test_id === identity.test_id) ?? null;
    const latestBySlug = latestRows.find((row) => row.slug === identity.slug) ?? null;

    if (latestBySlug && latestBySlug.test_id !== identity.test_id) {
      throw new ImportConversionError({
        code: "slug_conflict",
        status: 409,
        detail: `Slug '${identity.slug}' is already used by ${latestBySlug.test_id}.`
      });
    }

    if (!latestByTestId) {
      throw new ImportConversionError({
        code: "db_error",
        status: 500,
        detail: "Failed to resolve test row after insert race."
      });
    }

    if (latestByTestId.slug !== identity.slug) {
      throw new ImportConversionError({
        code: "test_conflict",
        status: 409,
        detail: `Test ${identity.test_id} already exists with slug '${latestByTestId.slug}'.`
      });
    }

    return latestByTestId;
  }
};

const loadDraftById = async (client: PoolClient, draftId: string): Promise<ImportDraftRecord> => {
  const { rows } = await client.query<DraftRow>(
    `
      SELECT
        tv.id,
        t.test_id,
        t.slug,
        t.default_locale,
        tv.version,
        tv.status,
        tv.spec_json,
        tv.source_import_id,
        tv.checksum,
        tv.created_at,
        tv.created_by
      FROM test_versions tv
      JOIN tests t
        ON t.id = tv.test_id
      WHERE tv.id = $1
      LIMIT 1
    `,
    [draftId]
  );

  const row = rows[0];
  if (!row) {
    throw new ImportConversionError({
      code: "db_error",
      status: 500,
      detail: "Inserted draft version could not be loaded."
    });
  }

  return toImportDraftRecord(row);
};

const loadExistingDraftByImportChecksum = async (
  client: PoolClient,
  importId: string,
  checksum: string
): Promise<ImportDraftRecord | null> => {
  const { rows } = await client.query<DraftRow>(
    `
      SELECT
        tv.id,
        t.test_id,
        t.slug,
        t.default_locale,
        tv.version,
        tv.status,
        tv.spec_json,
        tv.source_import_id,
        tv.checksum,
        tv.created_at,
        tv.created_by
      FROM test_versions tv
      JOIN tests t
        ON t.id = tv.test_id
      WHERE tv.source_import_id = $1
        AND tv.checksum = $2
      ORDER BY tv.version DESC
      LIMIT 1
    `,
    [importId, checksum]
  );

  const row = rows[0];
  return row ? toImportDraftRecord(row) : null;
};

const markImportProcessed = async (
  client: PoolClient,
  input: {
    import_id: string;
    metadata: ConversionMetadata;
    draft: ImportDraftRecord;
    checksum: string;
  }
): Promise<void> => {
  const detectedMeta = {
    format_id: input.metadata.format_id,
    test_id: input.metadata.test_id,
    slug: input.metadata.slug,
    en_title: input.metadata.en_title,
    checksum: input.checksum,
    draft_version: input.draft.version,
    draft_version_id: input.draft.id
  };

  await client.query(
    `
      UPDATE imports
      SET
        status = 'processed',
        error = NULL,
        detected_meta = $2::jsonb
      WHERE id = $1
    `,
    [input.import_id, JSON.stringify(detectedMeta)]
  );
};

const markImportFailed = async (importId: string, errorMessage: string): Promise<void> => {
  const normalizedImportId = normalizeNonEmptyString(importId);
  if (!normalizedImportId || !isValidImportId(normalizedImportId)) {
    return;
  }

  const pool = getContentDbPool();
  const safeError = sanitizeImportError(errorMessage);

  await pool.query(
    `
      UPDATE imports
      SET
        status = 'failed',
        error = $2
      WHERE id = $1
    `,
    [normalizedImportId, safeError]
  );
};

const upsertDraftVersion = async (input: {
  import_id: string;
  created_by: string | null;
  metadata: ConversionMetadata;
  spec_json: unknown;
  checksum: string;
}): Promise<{ draft: ImportDraftRecord; created: boolean }> => {
  const pool = getContentDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows: importRows } = await client.query<{ id: string }>(
      `
        SELECT id
        FROM imports
        WHERE id = $1
        FOR UPDATE
      `,
      [input.import_id]
    );

    if (!importRows[0]) {
      throw new ImportConversionError({
        code: "import_not_found",
        status: 404,
        detail: "Import does not exist."
      });
    }

    const test = await getOrCreateTest(client, {
      test_id: input.metadata.test_id,
      slug: input.metadata.slug
    });

    const existing = await loadExistingDraftByImportChecksum(
      client,
      input.import_id,
      input.checksum
    );

    if (existing) {
      await markImportProcessed(client, {
        import_id: input.import_id,
        metadata: input.metadata,
        draft: existing,
        checksum: input.checksum
      });
      await client.query("COMMIT");
      return {
        draft: existing,
        created: false
      };
    }

    const { rows: versionRows } = await client.query<{ next_version: number }>(
      `
        SELECT COALESCE(MAX(version), 0) + 1 AS next_version
        FROM test_versions
        WHERE test_id = $1
      `,
      [test.id]
    );

    const nextVersion = versionRows[0]?.next_version ?? 1;

    const { rows: insertedRows } = await client.query<{ id: string }>(
      `
        INSERT INTO test_versions (
          test_id,
          version,
          status,
          spec_json,
          source_import_id,
          checksum,
          created_by
        )
        VALUES (
          $1,
          $2,
          'draft',
          $3::jsonb,
          $4,
          $5,
          $6
        )
        RETURNING id
      `,
      [
        test.id,
        nextVersion,
        JSON.stringify(input.spec_json),
        input.import_id,
        input.checksum,
        input.created_by
      ]
    );

    const insertedId = insertedRows[0]?.id;
    if (!insertedId) {
      throw new ImportConversionError({
        code: "db_error",
        status: 500,
        detail: "Failed to insert draft version."
      });
    }

    const draft = await loadDraftById(client, insertedId);

    await markImportProcessed(client, {
      import_id: input.import_id,
      metadata: input.metadata,
      draft,
      checksum: input.checksum
    });

    await client.query("COMMIT");

    return {
      draft,
      created: true
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const convertImportToDraft = async (input: {
  import_id: string;
  created_by?: string | null;
}): Promise<ConvertImportToDraftResult> => {
  const normalizedImportId = normalizeNonEmptyString(input.import_id);
  if (!normalizedImportId || !isValidImportId(normalizedImportId)) {
    throw new ImportConversionError({
      code: "invalid_import_id",
      status: 400,
      detail: "Import ID is invalid."
    });
  }

  const importRecord = await getImportById(normalizedImportId);
  if (!importRecord) {
    throw new ImportConversionError({
      code: "import_not_found",
      status: 404,
      detail: "Import not found."
    });
  }

  try {
    const metadata = resolveConversionMetadata(importRecord.files_json);
    const conversion = await convertImportFilesToValidatedSpec(
      importRecord.files_json,
      metadata
    );

    const draftResult = await upsertDraftVersion({
      import_id: normalizedImportId,
      created_by: normalizeNonEmptyString(input.created_by ?? null),
      metadata,
      spec_json: conversion.spec_json,
      checksum: conversion.checksum
    });

    const latestImport = await getImportById(normalizedImportId);
    if (!latestImport) {
      throw new ImportConversionError({
        code: "db_error",
        status: 500,
        detail: "Import row disappeared after conversion."
      });
    }

    return {
      import: latestImport,
      draft: draftResult.draft,
      created: draftResult.created
    };
  } catch (error) {
    const normalizedError = asImportConversionError(error);
    if (!normalizedError.preserve_import_status) {
      const detail = normalizedError.detail ?? normalizedError.message;
      await markImportFailed(normalizedImportId, detail);
    }

    throw normalizedError;
  }
};

export const MAX_IMPORT_TOTAL_BYTES = 2_000_000;
export const MAX_IMPORT_FILES = 30;

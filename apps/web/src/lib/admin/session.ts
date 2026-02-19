import { normalizeString } from "@/lib/utils/strings";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export type AdminRole = "admin" | "editor";

export type AdminSessionPayload = {
  role: AdminRole;
  expires_at: string;
};

export const ADMIN_SESSION_COOKIE = "admin_session";
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 12;

const ADMIN_ROLES = new Set<AdminRole>(["admin", "editor"]);
const keyCache = new Map<string, Promise<CryptoKey>>();


const toBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

const fromBase64 = (value: string): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const toBase64Url = (bytes: Uint8Array): string => {
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const fromBase64Url = (value: string): Uint8Array => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (base64.length % 4)) % 4;
  return fromBase64(`${base64}${"=".repeat(padding)}`);
};

const encodeString = (value: string): string => {
  return toBase64Url(textEncoder.encode(value));
};

const decodeString = (value: string): string => {
  return textDecoder.decode(fromBase64Url(value));
};

const getSessionSecret = (): string | null => {
  return normalizeString(process.env.ADMIN_SESSION_SECRET);
};

const requireSessionSecret = (): string => {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is required.");
  }
  return secret;
};

const getHmacKey = (secret: string): Promise<CryptoKey> => {
  const cached = keyCache.get(secret);
  if (cached) {
    return cached;
  }

  const promise = crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  keyCache.set(secret, promise);
  return promise;
};

const signPayload = async (payloadEncoded: string, secret: string): Promise<string> => {
  const key = await getHmacKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(payloadEncoded)
  );
  return toBase64Url(new Uint8Array(signature));
};

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
};

const verifySignature = async (
  payloadEncoded: string,
  signatureEncoded: string,
  secret: string
): Promise<boolean> => {
  let signatureBytes: Uint8Array;
  try {
    signatureBytes = fromBase64Url(signatureEncoded);
  } catch {
    return false;
  }

  const key = await getHmacKey(secret);
  return crypto.subtle.verify(
    "HMAC",
    key,
    toArrayBuffer(signatureBytes),
    textEncoder.encode(payloadEncoded)
  );
};

const isAdminRoleValue = (value: unknown): value is AdminRole => {
  return typeof value === "string" && ADMIN_ROLES.has(value as AdminRole);
};

export const isAdminRole = (value: unknown): value is AdminRole => {
  return isAdminRoleValue(value);
};

const isSessionPayload = (value: unknown): value is AdminSessionPayload => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  const role = record.role;
  const expiresAt = normalizeString(record.expires_at);
  if (!isAdminRoleValue(role) || !expiresAt) {
    return false;
  }

  const expiresAtMs = Date.parse(expiresAt);
  return Number.isFinite(expiresAtMs);
};

const getEnvToken = (key: "ADMIN_TOKEN" | "EDITOR_TOKEN"): string | null => {
  return normalizeString(process.env[key]);
};

export const resolveAdminRoleFromToken = (token: string): AdminRole | null => {
  const normalizedToken = normalizeString(token);
  if (!normalizedToken) {
    return null;
  }

  const adminToken = getEnvToken("ADMIN_TOKEN");
  if (adminToken && normalizedToken === adminToken) {
    return "admin";
  }

  const editorToken = getEnvToken("EDITOR_TOKEN");
  if (editorToken && normalizedToken === editorToken) {
    return "editor";
  }

  return null;
};

export const issueAdminSession = async (
  role: AdminRole,
  options?: { now?: Date; ttlSeconds?: number }
): Promise<{ cookieValue: string; expiresAt: Date }> => {
  if (!isAdminRoleValue(role)) {
    throw new Error("Invalid admin role.");
  }

  const now = options?.now ?? new Date();
  const ttlSeconds = options?.ttlSeconds ?? ADMIN_SESSION_TTL_SECONDS;
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
    throw new Error("ttlSeconds must be a positive number.");
  }

  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
  const payload: AdminSessionPayload = {
    role,
    expires_at: expiresAt.toISOString()
  };
  const payloadEncoded = encodeString(JSON.stringify(payload));
  const signature = await signPayload(payloadEncoded, requireSessionSecret());

  return {
    cookieValue: `${payloadEncoded}.${signature}`,
    expiresAt
  };
};

export const verifyAdminSession = async (
  value: string | null | undefined,
  options?: { now?: Date }
): Promise<AdminSessionPayload | null> => {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }

  const parts = normalized.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [payloadEncoded, signatureEncoded] = parts;
  if (!payloadEncoded || !signatureEncoded) {
    return null;
  }

  const secret = getSessionSecret();
  if (!secret) {
    return null;
  }

  const isValidSignature = await verifySignature(payloadEncoded, signatureEncoded, secret);
  if (!isValidSignature) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeString(payloadEncoded));
  } catch {
    return null;
  }

  if (!isSessionPayload(parsed)) {
    return null;
  }

  const expiresAtMs = Date.parse(parsed.expires_at);
  const now = options?.now ?? new Date();
  if (expiresAtMs <= now.getTime()) {
    return null;
  }

  return parsed;
};

/**
 * Shared Base64URL encoding helpers.
 *
 * Canonical location — import from "@/lib/utils/encoding" or "@/lib/utils".
 * Do NOT copy these into other files.
 */

/** Encode a UTF-8 string as Base64URL (no padding). */
export const encodeBase64Url = (value: string): string => {
  return Buffer.from(value, "utf8").toString("base64url");
};

/** Decode a Base64URL string back to UTF-8. */
export const decodeBase64Url = (value: string): string => {
  return Buffer.from(value, "base64url").toString("utf8");
};

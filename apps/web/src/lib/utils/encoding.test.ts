import { describe, expect, it } from "vitest";

import { decodeBase64Url, encodeBase64Url } from "./encoding";

describe("encodeBase64Url / decodeBase64Url", () => {
  it("round-trips a simple ASCII string", () => {
    const input = "hello world";
    expect(decodeBase64Url(encodeBase64Url(input))).toBe(input);
  });

  it("round-trips an empty string", () => {
    expect(decodeBase64Url(encodeBase64Url(""))).toBe("");
  });

  it("round-trips special characters", () => {
    const input = "key=value&foo=bar+baz";
    expect(decodeBase64Url(encodeBase64Url(input))).toBe(input);
  });

  it("round-trips unicode characters", () => {
    const input = "Привет мир 🌍";
    expect(decodeBase64Url(encodeBase64Url(input))).toBe(input);
  });

  it("produces URL-safe output (no +, /, or =)", () => {
    const input = "subjects?that+need/padding===";
    const encoded = encodeBase64Url(input);
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it("round-trips JSON payload", () => {
    const payload = JSON.stringify({ sub: "user-123", exp: 1700000000 });
    expect(decodeBase64Url(encodeBase64Url(payload))).toBe(payload);
  });
});

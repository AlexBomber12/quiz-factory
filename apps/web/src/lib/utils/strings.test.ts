import { describe, expect, it } from "vitest";

import {
  normalizeString,
  normalizeStringStrict,
  parseBoolean,
  parsePositiveInt
} from "./strings";

describe("normalizeString", () => {
  it("returns null for null", () => {
    expect(normalizeString(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(normalizeString(undefined)).toBeNull();
  });

  it("returns null for non-string types", () => {
    expect(normalizeString(42)).toBeNull();
    expect(normalizeString(true)).toBeNull();
    expect(normalizeString({})).toBeNull();
    expect(normalizeString([])).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizeString("")).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(normalizeString("   ")).toBeNull();
    expect(normalizeString("\t\n")).toBeNull();
  });

  it("trims and returns valid strings", () => {
    expect(normalizeString("hello")).toBe("hello");
    expect(normalizeString("  hello  ")).toBe("hello");
    expect(normalizeString("\thello\n")).toBe("hello");
  });
});

describe("normalizeStringStrict", () => {
  it("returns null for null", () => {
    expect(normalizeStringStrict(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(normalizeStringStrict(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizeStringStrict("")).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(normalizeStringStrict("   ")).toBeNull();
  });

  it("trims and returns valid strings", () => {
    expect(normalizeStringStrict("hello")).toBe("hello");
    expect(normalizeStringStrict("  hello  ")).toBe("hello");
  });
});

describe("parsePositiveInt", () => {
  it("returns undefined for undefined", () => {
    expect(parsePositiveInt(undefined)).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(parsePositiveInt("")).toBeUndefined();
  });

  it("returns undefined for zero", () => {
    expect(parsePositiveInt("0")).toBeUndefined();
  });

  it("returns undefined for negative numbers", () => {
    expect(parsePositiveInt("-1")).toBeUndefined();
    expect(parsePositiveInt("-100")).toBeUndefined();
  });

  it("returns undefined for NaN", () => {
    expect(parsePositiveInt("abc")).toBeUndefined();
    expect(parsePositiveInt("NaN")).toBeUndefined();
  });

  it("returns undefined for Infinity", () => {
    expect(parsePositiveInt("Infinity")).toBeUndefined();
    expect(parsePositiveInt("-Infinity")).toBeUndefined();
  });

  it("truncates floats to integer part", () => {
    expect(parsePositiveInt("3.7")).toBe(3);
    expect(parsePositiveInt("1.0")).toBe(1);
  });

  it("parses valid positive integers", () => {
    expect(parsePositiveInt("1")).toBe(1);
    expect(parsePositiveInt("42")).toBe(42);
    expect(parsePositiveInt("1000")).toBe(1000);
  });
});

describe("parseBoolean", () => {
  it("returns undefined for undefined", () => {
    expect(parseBoolean(undefined)).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(parseBoolean("")).toBeUndefined();
  });

  it("returns true for truthy values", () => {
    expect(parseBoolean("1")).toBe(true);
    expect(parseBoolean("true")).toBe(true);
    expect(parseBoolean("TRUE")).toBe(true);
    expect(parseBoolean("yes")).toBe(true);
    expect(parseBoolean("YES")).toBe(true);
    expect(parseBoolean("on")).toBe(true);
    expect(parseBoolean("ON")).toBe(true);
  });

  it("returns false for falsy values", () => {
    expect(parseBoolean("0")).toBe(false);
    expect(parseBoolean("false")).toBe(false);
    expect(parseBoolean("FALSE")).toBe(false);
    expect(parseBoolean("no")).toBe(false);
    expect(parseBoolean("NO")).toBe(false);
    expect(parseBoolean("off")).toBe(false);
    expect(parseBoolean("OFF")).toBe(false);
  });

  it("returns undefined for unrecognised input", () => {
    expect(parseBoolean("maybe")).toBeUndefined();
    expect(parseBoolean("2")).toBeUndefined();
    expect(parseBoolean("yep")).toBeUndefined();
  });

  it("trims whitespace before parsing", () => {
    expect(parseBoolean("  true  ")).toBe(true);
    expect(parseBoolean("  false  ")).toBe(false);
  });
});

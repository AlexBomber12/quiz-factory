import { describe, expect, it } from "vitest";

import { parseRouteIdentifier } from "./shared";

describe("parseRouteIdentifier tenant_id validation", () => {
  it("accepts and trims a valid tenant_id", () => {
    const parsed = parseRouteIdentifier(" tenant-quizfactory-en ", "tenant_id");

    expect(parsed).toEqual({
      ok: true,
      value: "tenant-quizfactory-en"
    });
  });

  it("returns 400 when tenant_id is empty", async () => {
    const parsed = parseRouteIdentifier("   ", "tenant_id");

    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      return;
    }

    expect(parsed.response.status).toBe(400);
    await expect(parsed.response.json()).resolves.toEqual({
      error: "invalid_path_param",
      details: [
        {
          field: "tenant_id",
          message: "must be provided"
        }
      ]
    });
  });

  it("returns 400 when tenant_id contains invalid characters or exceeds length", async () => {
    const withControlCharacter = parseRouteIdentifier("tenant-\u0000bad", "tenant_id");
    const overlong = parseRouteIdentifier(`tenant-${"x".repeat(200)}`, "tenant_id");

    expect(withControlCharacter.ok).toBe(false);
    if (!withControlCharacter.ok) {
      expect(withControlCharacter.response.status).toBe(400);
      await expect(withControlCharacter.response.json()).resolves.toEqual({
        error: "invalid_path_param",
        details: [
          {
            field: "tenant_id",
            message: "contains control characters"
          }
        ]
      });
    }

    expect(overlong.ok).toBe(false);
    if (!overlong.ok) {
      expect(overlong.response.status).toBe(400);
      await expect(overlong.response.json()).resolves.toEqual({
        error: "invalid_path_param",
        details: [
          {
            field: "tenant_id",
            message: "must be 120 characters or fewer"
          }
        ]
      });
    }
  });
});

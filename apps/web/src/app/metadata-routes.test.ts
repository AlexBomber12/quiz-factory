import { beforeEach, describe, expect, it, vi } from "vitest";

let headerValues: Record<string, string> = {};

vi.mock("next/headers", () => ({
  headers: () => new Headers(headerValues)
}));

import robots from "./robots";
import sitemap from "./sitemap";

const setHeaders = (values: Record<string, string>) => {
  headerValues = values;
};

describe("metadata routes", () => {
  beforeEach(() => {
    setHeaders({
      host: "tenant.example.com",
      "x-forwarded-proto": "https"
    });
  });

  it("includes tenant test landing urls in sitemap", async () => {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain("https://tenant.example.com/");
    expect(urls).toContain("https://tenant.example.com/t/focus-rhythm");
  });

  it("disallows non-index routes in robots", async () => {
    const result = await robots();
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;

    expect(rules?.disallow).toEqual([
      "/t/*/run",
      "/t/*/preview",
      "/t/*/pay",
      "/report/*",
      "/checkout/*"
    ]);
  });
});

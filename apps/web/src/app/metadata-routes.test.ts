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

  it("includes deterministic lastmod values in sitemap", async () => {
    const first = await sitemap();
    const second = await sitemap();
    const homeUrl = "https://tenant.example.com/";
    const testUrl = "https://tenant.example.com/t/focus-rhythm";

    const firstHome = first.find((entry) => entry.url === homeUrl);
    const secondHome = second.find((entry) => entry.url === homeUrl);
    const firstTest = first.find((entry) => entry.url === testUrl);
    const secondTest = second.find((entry) => entry.url === testUrl);

    expect(typeof firstHome?.lastModified).toBe("string");
    expect(typeof firstTest?.lastModified).toBe("string");
    expect(firstHome?.lastModified).toBe(secondHome?.lastModified);
    expect(firstTest?.lastModified).toBe(secondTest?.lastModified);
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

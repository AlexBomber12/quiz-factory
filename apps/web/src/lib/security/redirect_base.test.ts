import { describe, expect, it } from "vitest";

import { buildRedirectUrl, resolvePublicBase } from "./redirect_base";

const buildRequest = (url: string, headers: Record<string, string> = {}): Request => {
  return new Request(url, {
    headers: new Headers(headers)
  });
};

describe("redirect base helpers", () => {
  it("uses Origin when present, even when request.url host is internal", () => {
    const request = buildRequest("http://0.0.0.0:3000/api/admin/login", {
      origin: "https://qf.nexavi.co"
    });

    const base = resolvePublicBase(request);
    const redirect = buildRedirectUrl(request, "admin");

    expect(base).toEqual({
      origin: "https://qf.nexavi.co",
      protocol: "https",
      host: "qf.nexavi.co"
    });
    expect(redirect.toString()).toBe("https://qf.nexavi.co/admin");
  });

  it("falls back to x-forwarded-proto and x-forwarded-host", () => {
    const request = buildRequest("http://0.0.0.0:3000/api/admin/login", {
      "x-forwarded-proto": "https",
      "x-forwarded-host": "qf.nexavi.co"
    });

    expect(resolvePublicBase(request)).toEqual({
      origin: "https://qf.nexavi.co",
      protocol: "https",
      host: "qf.nexavi.co"
    });
  });

  it("falls back to host header when forwarded headers are missing", () => {
    const request = buildRequest("http://0.0.0.0:3000/api/admin/login", {
      host: "localhost:3000"
    });

    expect(resolvePublicBase(request)).toEqual({
      origin: "http://localhost:3000",
      protocol: "http",
      host: "localhost:3000"
    });
  });

  it("takes first values from comma-separated forwarded headers", () => {
    const request = buildRequest("http://0.0.0.0:3000/api/admin/login", {
      "x-forwarded-proto": "https, http",
      "x-forwarded-host": "qf.nexavi.co,internal.service:3000"
    });

    expect(resolvePublicBase(request)).toEqual({
      origin: "https://qf.nexavi.co",
      protocol: "https",
      host: "qf.nexavi.co"
    });
  });

  it("prefers forwarded host when request host is internal", () => {
    const request = buildRequest("http://0.0.0.0:3000/api/admin/login", {
      host: "0.0.0.0:3000",
      "x-forwarded-host": "qf.nexavi.co"
    });

    expect(resolvePublicBase(request)).toEqual({
      origin: "http://qf.nexavi.co",
      protocol: "http",
      host: "qf.nexavi.co"
    });
  });
});

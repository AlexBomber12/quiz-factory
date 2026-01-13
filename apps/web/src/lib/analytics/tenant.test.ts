import { describe, expect, it } from "vitest";

import {
  parseAcceptLanguage,
  resolveLocale,
  resolveTenant
} from "../tenants/resolve";

const resolveTenantWithHeaders = (headers: Record<string, string>) => {
  return resolveTenant(new Headers(headers));
};

describe("resolveTenant", () => {
  it("matches configured domains to tenant_id", () => {
    const result = resolveTenantWithHeaders({ host: "tenant.example.com" });

    expect(result.tenantId).toBe("tenant-tenant-example-com");
    expect(result.defaultLocale).toBe("en");
  });

  it("prefers x-forwarded-host", () => {
    const result = resolveTenantWithHeaders({
      "x-forwarded-host": "tenant.example.com",
      host: "other.example.com"
    });

    expect(result.tenantId).toBe("tenant-tenant-example-com");
  });

  it("falls back to slug-based tenant ids", () => {
    const result = resolveTenantWithHeaders({ host: "Quiz.Example.com" });

    expect(result.tenantId).toBe("tenant-quiz-example-com");
    expect(result.defaultLocale).toBeNull();
  });

  it("strips ports from hostnames", () => {
    const result = resolveTenantWithHeaders({ host: "tenant.example.com:3000" });

    expect(result.tenantId).toBe("tenant-tenant-example-com");
  });
});

describe("parseAcceptLanguage", () => {
  it("parses the first tag", () => {
    expect(parseAcceptLanguage("en-US,en;q=0.9")).toBe("en-US");
  });

  it("normalizes casing", () => {
    expect(parseAcceptLanguage("pt-br,pt;q=0.9")).toBe("pt-BR");
  });

  it("falls back to en for invalid headers", () => {
    expect(parseAcceptLanguage("*")).toBe("en");
    expect(parseAcceptLanguage("not-a-locale")).toBe("en");
  });
});

describe("resolveLocale", () => {
  it("prefers tenant default locale", () => {
    const locale = resolveLocale({
      defaultLocale: "es",
      acceptLanguage: "en-US,en;q=0.9"
    });

    expect(locale).toBe("es");
  });

  it("uses Accept-Language when tenant default is missing", () => {
    const locale = resolveLocale({
      defaultLocale: null,
      acceptLanguage: "pt-BR,pt;q=0.9"
    });

    expect(locale).toBe("pt-BR");
  });

  it("falls back to en when no inputs are available", () => {
    expect(resolveLocale({ defaultLocale: null, acceptLanguage: null })).toBe("en");
  });
});

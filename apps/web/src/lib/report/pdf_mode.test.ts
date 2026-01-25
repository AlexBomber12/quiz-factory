import { afterEach, describe, expect, it } from "vitest";

import { resolveReportPdfMode } from "./pdf_mode";

afterEach(() => {
  delete process.env.REPORT_PDF_MODE;
});

describe("report pdf mode", () => {
  it("defaults to client mode", () => {
    delete process.env.REPORT_PDF_MODE;
    expect(resolveReportPdfMode()).toBe("client");
  });

  it("enables server mode when configured", () => {
    process.env.REPORT_PDF_MODE = "server";
    expect(resolveReportPdfMode()).toBe("server");
  });

  it("falls back to client mode on invalid values", () => {
    process.env.REPORT_PDF_MODE = "something-else";
    expect(resolveReportPdfMode()).toBe("client");
  });
});

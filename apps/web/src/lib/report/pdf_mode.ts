export type ReportPdfMode = "client" | "server";

const DEFAULT_MODE: ReportPdfMode = "client";

const normalizeMode = (value: string | undefined): ReportPdfMode => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "server") {
    return "server";
  }
  return DEFAULT_MODE;
};

export const resolveReportPdfMode = (): ReportPdfMode => {
  return normalizeMode(process.env.REPORT_PDF_MODE);
};

export const isServerReportPdfMode = (): boolean => {
  return resolveReportPdfMode() === "server";
};

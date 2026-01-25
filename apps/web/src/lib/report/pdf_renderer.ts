const DEFAULT_RENDER_TIMEOUT_MS = 45_000;

export type ReportPdfCookie = {
  name: string;
  value: string;
};

export type ReportPdfRenderOptions = {
  url: string;
  locale: string;
  cookies: ReportPdfCookie[];
};

const normalizeString = (value: string | undefined | null): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parsePositiveInt = (value: string | undefined): number | null => {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const resolveRenderTimeoutMs = (): number => {
  const fromEnv = parsePositiveInt(process.env.REPORT_PDF_RENDER_TIMEOUT_MS);
  return fromEnv ?? DEFAULT_RENDER_TIMEOUT_MS;
};

export const renderReportPdf = async (options: ReportPdfRenderOptions): Promise<Buffer> => {
  const timeoutMs = resolveRenderTimeoutMs();
  const { chromium } = await import("playwright");

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      locale: options.locale,
      ignoreHTTPSErrors: true
    });

    try {
      const cookieList = options.cookies
        .map((cookie) => ({
          name: normalizeString(cookie.name),
          value: normalizeString(cookie.value)
        }))
        .filter(
          (cookie): cookie is { name: string; value: string } =>
            Boolean(cookie.name) && Boolean(cookie.value)
        )
        .map((cookie) => ({ ...cookie, url: options.url }));

      if (cookieList.length > 0) {
        await context.addCookies(cookieList);
      }

      const page = await context.newPage();
      page.setDefaultNavigationTimeout(timeoutMs);
      page.setDefaultTimeout(timeoutMs);

      await page.addInitScript(() => {
        // Disable print dialogs when rendering in headless mode.
        window.print = () => undefined;
      });

      await page.goto(options.url, { waitUntil: "networkidle", timeout: timeoutMs });
      await page.emulateMedia({ media: "print" });
      await page.waitForLoadState("networkidle", { timeout: timeoutMs });

      return await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true
      });
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
};

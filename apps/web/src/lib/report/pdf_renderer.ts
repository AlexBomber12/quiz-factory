import { normalizeStringStrict, parsePositiveInt } from "@/lib/utils/strings";

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
          name: normalizeStringStrict(cookie.name),
          value: normalizeStringStrict(cookie.value)
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

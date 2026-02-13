import { expect, test, type Locator, type Page } from "playwright/test";
import { completeFocusRhythmRunner, FOCUS_RHYTHM_RUN_PATH } from "./helpers/focus_rhythm";

const GOLDEN_VIEWPORT = { width: 1280, height: 720 };

const waitForFonts = async (page: Page): Promise<void> => {
  await page.evaluate(async () => {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
  });
};

const hideDevRuntimeOverlays = async (page: Page): Promise<void> => {
  await page.addStyleTag({
    content: `
      nextjs-portal,
      [data-nextjs-toast],
      [data-next-badge-root],
      [data-nextjs-dev-tools-button] {
        display: none !important;
      }
    `
  });
};

const captureGoldenScreenshot = async (
  page: Page,
  stableLocator: Locator,
  screenshotName: string
): Promise<void> => {
  await stableLocator.waitFor({ state: "visible" });
  await hideDevRuntimeOverlays(page);
  await waitForFonts(page);
  await expect(page).toHaveScreenshot(screenshotName, {
    fullPage: true,
    animations: "disabled",
    caret: "hide"
  });
};

test.describe("golden public pages visual regression", () => {
  test.use({ viewport: GOLDEN_VIEWPORT });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      document.documentElement.setAttribute("data-visual-test", "true");
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("captures golden routes", async ({ page }) => {
    await page.goto("/");
    await captureGoldenScreenshot(
      page,
      page.getByRole("textbox", {
        name: "Search tests by title, description, or category"
      }),
      "01-home.png"
    );

    await page.goto("/tests");
    await captureGoldenScreenshot(
      page,
      page.getByRole("heading", { level: 1, name: "Tests" }),
      "02-tests.png"
    );

    await page.goto("/t/focus-rhythm");
    await captureGoldenScreenshot(
      page,
      page.getByRole("heading", { name: "What you get" }),
      "03-test-landing.png"
    );

    await page.goto(FOCUS_RHYTHM_RUN_PATH);
    await captureGoldenScreenshot(
      page,
      page.getByTestId("runner-start-button"),
      "04-runner-start.png"
    );

    await completeFocusRhythmRunner(page);
    const unlockFullReportLink = page.getByRole("link", { name: "Unlock full report" });
    await captureGoldenScreenshot(page, unlockFullReportLink, "05-preview.png");

    await unlockFullReportLink.click();
    await expect(page).toHaveURL(/\/t\/focus-rhythm\/pay(?:\?.*)?$/);
    await captureGoldenScreenshot(
      page,
      page.getByRole("heading", { name: "Choose your report" }),
      "06-paywall.png"
    );
  });
});

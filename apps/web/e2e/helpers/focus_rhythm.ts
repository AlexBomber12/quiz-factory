import { expect, type Page } from "playwright/test";

const COMPLETE_API_PATH = "/api/test/complete";
const MAX_QUESTIONS = 40;

export const FOCUS_RHYTHM_RUN_PATH = "/t/focus-rhythm/run";
export const FOCUS_RHYTHM_PREVIEW_PATH_PATTERN = /\/t\/focus-rhythm\/preview(?:\?.*)?$/;

export const completeFocusRhythmRunner = async (page: Page): Promise<void> => {
  await page.goto(FOCUS_RHYTHM_RUN_PATH);
  await page.getByTestId("runner-start-button").click();

  for (let answeredCount = 0; answeredCount < MAX_QUESTIONS; answeredCount += 1) {
    const firstOption = page.getByTestId("runner-first-option");
    await expect(firstOption).toBeVisible();
    await firstOption.click();

    const finishButton = page.getByTestId("runner-finish-button");
    if (await finishButton.isVisible()) {
      const completeResponsePromise = page.waitForResponse((response) => {
        const responseUrl = new URL(response.url());
        return (
          responseUrl.pathname === COMPLETE_API_PATH &&
          response.request().method() === "POST"
        );
      });

      await finishButton.click();

      const completeResponse = await completeResponsePromise;
      expect(completeResponse.status()).toBe(200);
      await expect(page).toHaveURL(FOCUS_RHYTHM_PREVIEW_PATH_PATTERN);
      await expect(page.getByTestId("runner-error-banner")).toHaveCount(0);
      return;
    }

    await page.getByTestId("runner-next-button").click();
  }

  throw new Error("Runner did not finish within the max question count.");
};

import { expect, test } from "playwright/test";

const COMPLETE_API_PATH = "/api/test/complete";
const PREVIEW_PATH_PATTERN = /\/t\/focus-rhythm\/preview(?:\?.*)?$/;

test("focus rhythm runner completes without 401 @smoke", async ({ page }) => {
  await page.goto("/");
  await page.goto("/t/focus-rhythm/run");

  await page.getByTestId("runner-start-button").click();

  const maxQuestions = 40;
  let completed = false;

  for (let answeredCount = 0; answeredCount < maxQuestions; answeredCount += 1) {
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
      await expect(page).toHaveURL(PREVIEW_PATH_PATTERN);
      await expect(page.getByTestId("runner-error-banner")).toHaveCount(0);
      completed = true;
      break;
    }

    await page.getByTestId("runner-next-button").click();
  }

  expect(completed).toBe(true);
});

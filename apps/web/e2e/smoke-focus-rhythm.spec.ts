import { test } from "playwright/test";
import { completeFocusRhythmRunner } from "./helpers/focus_rhythm";

test("focus rhythm runner completes without 401 @smoke", async ({ page }) => {
  await page.goto("/");
  await completeFocusRhythmRunner(page);
});

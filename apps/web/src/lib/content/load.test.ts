import { describe, expect, it } from "vitest";

import { loadLocalizedTest } from "./load";

const TEST_ID = "test-focus-rhythm";
const LOCALES = ["en", "es", "pt-BR"] as const;

describe("content loader", () => {
  for (const locale of LOCALES) {
    it(`loads ${locale} content`, () => {
      const test = loadLocalizedTest(TEST_ID, locale);

      expect(test.questions.length).toBeGreaterThan(0);
      expect(test.title).toBeTruthy();
      expect(test.description).toBeTruthy();
      expect(test.intro).toBeTruthy();
      expect(test.paywall_headline).toBeTruthy();
      expect(test.report_title).toBeTruthy();
    });
  }
});

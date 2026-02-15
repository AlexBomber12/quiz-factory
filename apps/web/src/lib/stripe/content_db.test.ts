import { afterEach, describe, expect, it } from "vitest";

import { createStripeContentDbStore } from "./content_db";

const originalContentDatabaseUrl = process.env.CONTENT_DATABASE_URL;

const restoreContentDatabaseUrl = (): void => {
  if (typeof originalContentDatabaseUrl === "string") {
    process.env.CONTENT_DATABASE_URL = originalContentDatabaseUrl;
  } else {
    delete process.env.CONTENT_DATABASE_URL;
  }
};

describe("createStripeContentDbStore", () => {
  afterEach(() => {
    restoreContentDatabaseUrl();
  });

  it("returns null when CONTENT_DATABASE_URL is missing", () => {
    delete process.env.CONTENT_DATABASE_URL;

    expect(createStripeContentDbStore()).toBeNull();
  });
});

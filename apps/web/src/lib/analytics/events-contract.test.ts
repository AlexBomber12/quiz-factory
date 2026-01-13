import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";

import { ANALYTICS_EVENT_NAMES } from "./events";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../../"
);
const eventsPath = path.join(rootDir, "analytics/events.json");

describe("analytics events contract", () => {
  it("matches analytics/events.json", () => {
    const eventsJson = JSON.parse(readFileSync(eventsPath, "utf8")) as Record<
      string,
      unknown
    >;
    const jsonEventNames = Object.keys(eventsJson)
      .filter((name) => name !== "forbidden_properties")
      .sort();
    const codeEventNames = [...ANALYTICS_EVENT_NAMES].sort();

    expect(codeEventNames).toEqual(jsonEventNames);
  });
});

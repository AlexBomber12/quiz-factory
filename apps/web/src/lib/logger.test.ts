import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "./logger";

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_LOG_LEVEL = process.env.LOG_LEVEL;
const MUTABLE_ENV = process.env as Record<string, string | undefined>;

const setEnv = (key: string, value: string | undefined): void => {
  if (value === undefined) {
    delete MUTABLE_ENV[key];
    return;
  }

  MUTABLE_ENV[key] = value;
};

describe("logger", () => {
  const logSpy = vi.spyOn(console, "log");

  beforeEach(() => {
    logSpy.mockImplementation(() => undefined);
  });

  afterEach(() => {
    setEnv("NODE_ENV", ORIGINAL_NODE_ENV);
    setEnv("LOG_LEVEL", ORIGINAL_LOG_LEVEL);

    logSpy.mockClear();
  });

  it("writes JSON entries in production", () => {
    setEnv("NODE_ENV", "production");
    setEnv("LOG_LEVEL", "debug");

    logger.info({ tenantId: "tenant-1" }, "event ingested");

    expect(logSpy).toHaveBeenCalledTimes(1);
    const output = logSpy.mock.calls[0]?.[0];
    expect(typeof output).toBe("string");

    const parsed = JSON.parse(String(output).trim()) as Record<string, unknown>;
    expect(parsed.level).toBe("info");
    expect(parsed.message).toBe("event ingested");
    expect(parsed.tenantId).toBe("tenant-1");
    expect(typeof parsed.timestamp).toBe("string");
  });

  it("serializes Error objects in the error context field", () => {
    setEnv("NODE_ENV", "production");
    setEnv("LOG_LEVEL", "debug");

    const error = new Error("boom");
    logger.error({ error }, "failed to send webhook");

    const output = logSpy.mock.calls[0]?.[0];
    const parsed = JSON.parse(String(output).trim()) as {
      error?: { message?: string; stack?: string; name?: string };
    };

    expect(parsed.error?.message).toBe("boom");
    expect(parsed.error?.name).toBe("Error");
    expect(typeof parsed.error?.stack).toBe("string");
  });

  it("filters below LOG_LEVEL threshold", () => {
    setEnv("NODE_ENV", "production");
    setEnv("LOG_LEVEL", "warn");

    logger.info({}, "ignore this");
    logger.error({}, "keep this");

    expect(logSpy).toHaveBeenCalledTimes(1);
    const output = logSpy.mock.calls[0]?.[0];
    const parsed = JSON.parse(String(output).trim()) as Record<string, unknown>;
    expect(parsed.level).toBe("error");
    expect(parsed.message).toBe("keep this");
  });
});

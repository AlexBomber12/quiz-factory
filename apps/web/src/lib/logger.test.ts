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
  const warnSpy = vi.spyOn(console, "warn");
  const errorSpy = vi.spyOn(console, "error");

  beforeEach(() => {
    logSpy.mockImplementation(() => undefined);
    warnSpy.mockImplementation(() => undefined);
    errorSpy.mockImplementation(() => undefined);
  });

  afterEach(() => {
    setEnv("NODE_ENV", ORIGINAL_NODE_ENV);
    setEnv("LOG_LEVEL", ORIGINAL_LOG_LEVEL);

    logSpy.mockClear();
    warnSpy.mockClear();
    errorSpy.mockClear();
  });

  it("writes info JSON entries to stdout in production", () => {
    setEnv("NODE_ENV", "production");
    setEnv("LOG_LEVEL", "debug");

    logger.info({ tenantId: "tenant-1" }, "event ingested");

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
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

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    const output = errorSpy.mock.calls[0]?.[0];
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
    logger.warn({}, "warn this");
    logger.error({}, "keep this");

    expect(logSpy).toHaveBeenCalledTimes(0);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const warning = JSON.parse(String(warnSpy.mock.calls[0]?.[0]).trim()) as Record<
      string,
      unknown
    >;
    const failure = JSON.parse(String(errorSpy.mock.calls[0]?.[0]).trim()) as Record<
      string,
      unknown
    >;
    expect(warning.level).toBe("warn");
    expect(warning.message).toBe("warn this");
    expect(failure.level).toBe("error");
    expect(failure.message).toBe("keep this");
  });

  it("serializes circular objects safely", () => {
    setEnv("NODE_ENV", "production");
    setEnv("LOG_LEVEL", "debug");

    const circular: { self?: unknown; nested?: unknown } = {};
    circular.self = circular;
    circular.nested = { parent: circular };

    expect(() => logger.error({ circular }, "circular context")).not.toThrow();
    expect(errorSpy).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(String(errorSpy.mock.calls[0]?.[0]).trim()) as {
      circular?: { self?: string; nested?: { parent?: string } };
    };
    expect(payload.circular?.self).toBe("[Circular]");
    expect(payload.circular?.nested?.parent).toBe("[Circular]");
  });

  it("serializes bigint values safely", () => {
    setEnv("NODE_ENV", "production");
    setEnv("LOG_LEVEL", "debug");

    expect(() =>
      logger.error(
        { count: 1n, nested: { value: 2n }, list: [3n, { deep: 4n }] },
        "bigint context"
      )
    ).not.toThrow();
    expect(errorSpy).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(String(errorSpy.mock.calls[0]?.[0]).trim()) as {
      count?: string;
      nested?: { value?: string };
      list?: Array<string | { deep?: string }>;
    };
    expect(payload.count).toBe("1");
    expect(payload.nested?.value).toBe("2");
    expect(payload.list?.[0]).toBe("3");
    expect((payload.list?.[1] as { deep?: string }).deep).toBe("4");
  });

  it("falls back when object serialization throws", () => {
    setEnv("NODE_ENV", "production");
    setEnv("LOG_LEVEL", "debug");

    const throwingValue: Record<string, unknown> = {};
    Object.defineProperty(throwingValue, "boom", {
      enumerable: true,
      get() {
        throw new Error("getter failed");
      }
    });

    expect(() => logger.error({ error: throwingValue }, "unserializable context")).not.toThrow();
    expect(errorSpy).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(String(errorSpy.mock.calls[0]?.[0]).trim()) as {
      error?: string;
    };
    expect(payload.error).toBe("[Unserializable Object]");
  });

  it("falls back when array serialization throws", () => {
    setEnv("NODE_ENV", "production");
    setEnv("LOG_LEVEL", "debug");

    const throwingArray: unknown[] = [];
    Object.defineProperty(throwingArray, "0", {
      enumerable: true,
      get() {
        throw new Error("array getter failed");
      }
    });
    throwingArray.length = 1;

    expect(() => logger.error({ error: throwingArray }, "unserializable array")).not.toThrow();
    expect(errorSpy).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(String(errorSpy.mock.calls[0]?.[0]).trim()) as {
      error?: string;
    };
    expect(payload.error).toBe("[Unserializable Array]");
  });
});

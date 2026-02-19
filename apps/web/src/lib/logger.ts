export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogContext = Record<string, unknown>;

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: "\u001b[36m",
  info: "\u001b[32m",
  warn: "\u001b[33m",
  error: "\u001b[31m"
};

const COLOR_RESET = "\u001b[0m";
const CIRCULAR_REFERENCE = "[Circular]";
const UNSERIALIZABLE_ARRAY = "[Unserializable Array]";
const UNSERIALIZABLE_OBJECT = "[Unserializable Object]";

const parseLogLevel = (value: string | undefined): LogLevel | undefined => {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "debug" || normalized === "info" || normalized === "warn" || normalized === "error") {
    return normalized;
  }

  return undefined;
};

const resolveMinimumLevel = (): LogLevel | null => {
  const explicitLevel = parseLogLevel(process.env.LOG_LEVEL);
  if (explicitLevel) {
    return explicitLevel;
  }

  if (process.env.NODE_ENV === "test") {
    return null;
  }

  if (process.env.NODE_ENV === "production") {
    return "info";
  }

  return "debug";
};

const shouldLog = (level: LogLevel): boolean => {
  const minimumLevel = resolveMinimumLevel();
  if (!minimumLevel) {
    return false;
  }

  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minimumLevel];
};

const serializeValue = (
  value: unknown,
  visited: WeakSet<object> = new WeakSet()
): unknown => {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack
    };
  }

  if (Array.isArray(value)) {
    if (visited.has(value)) {
      return CIRCULAR_REFERENCE;
    }

    visited.add(value);
    try {
      return value.map((item) => serializeValue(item, visited));
    } catch {
      return UNSERIALIZABLE_ARRAY;
    } finally {
      visited.delete(value);
    }
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (visited.has(record)) {
      return CIRCULAR_REFERENCE;
    }

    visited.add(record);
    try {
      const entries = Object.entries(record);
      return Object.fromEntries(
        entries.map(([key, item]) => [key, serializeValue(item, visited)])
      );
    } catch {
      return UNSERIALIZABLE_OBJECT;
    } finally {
      visited.delete(record);
    }
  }

  return value;
};

type LogEntry = {
  timestamp: string;
  level: LogLevel;
  message: string;
} & LogContext;

const buildEntry = (level: LogLevel, context: LogContext, message: string): LogEntry => {
  const serializedContext = Object.fromEntries(
    Object.entries(context).map(([key, value]) => [key, serializeValue(value)])
  );

  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...serializedContext
  };
};

const write = (entry: LogEntry): void => {
  if (process.env.NODE_ENV === "production") {
    const rendered = JSON.stringify(entry);

    if (entry.level === "error") {
      console.error(rendered);
      return;
    }

    if (entry.level === "warn") {
      console.warn(rendered);
      return;
    }

    console.log(rendered);
    return;
  }

  const { timestamp, level, message, ...context } = entry;
  const contextSuffix =
    Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : "";
  const color = LEVEL_COLORS[level];
  const rendered = `${timestamp} ${color}${level.toUpperCase()}${COLOR_RESET} ${message}${contextSuffix}`;
  if (level === "error") {
    console.error(rendered);
    return;
  }

  if (level === "warn") {
    console.warn(rendered);
    return;
  }

  if (level === "info") {
    console.info(rendered);
    return;
  }

  console.debug(rendered);
};

const log = (level: LogLevel, context: LogContext, message: string): void => {
  if (!shouldLog(level)) {
    return;
  }

  write(buildEntry(level, context, message));
};

export const logger = {
  debug(context: LogContext, message: string): void {
    log("debug", context, message);
  },
  info(context: LogContext, message: string): void {
    log("info", context, message);
  },
  warn(context: LogContext, message: string): void {
    log("warn", context, message);
  },
  error(context: LogContext, message: string): void {
    log("error", context, message);
  }
};

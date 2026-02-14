export type AnalyticsDateRange = {
  start: string;
  end: string;
};

const YYYY_MM_DD_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const toUtcDate = (value: Date): Date => {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
};

export const formatDateYYYYMMDD = (value: Date): string => {
  const year = value.getUTCFullYear();
  const month = `${value.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${value.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const parseDateYYYYMMDD = (value: string | null | undefined): Date | null => {
  if (!value) {
    return null;
  }

  const match = value.match(YYYY_MM_DD_PATTERN);
  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
};

export const getDefaultAnalyticsDateRange = (now: Date = new Date()): AnalyticsDateRange => {
  const endDate = toUtcDate(now);
  const startDate = new Date(endDate.getTime());
  startDate.setUTCDate(startDate.getUTCDate() - 6);

  return {
    start: formatDateYYYYMMDD(startDate),
    end: formatDateYYYYMMDD(endDate)
  };
};

export const resolveAnalyticsDateRange = (
  input: { start?: string | null; end?: string | null },
  now: Date = new Date()
): AnalyticsDateRange => {
  const defaults = getDefaultAnalyticsDateRange(now);
  const startDate = parseDateYYYYMMDD(input.start ?? null);
  const endDate = parseDateYYYYMMDD(input.end ?? null);

  if (!startDate || !endDate) {
    return defaults;
  }

  if (startDate.getTime() > endDate.getTime()) {
    return defaults;
  }

  return {
    start: formatDateYYYYMMDD(startDate),
    end: formatDateYYYYMMDD(endDate)
  };
};

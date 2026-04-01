const DEFAULT_TIME_ZONE = "UTC";

export const DEFAULT_PLANNING_EARLIEST_TIME = "08:00";
export const DEFAULT_PLANNING_LATEST_TIME = "21:00";
export const TIME_STRING_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

type TimeParts = {
  hour: number;
  minute: number;
  second: number;
};

type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const dateTimeFormatterCache = new Map<string, Intl.DateTimeFormat>();

function hasOwn<K extends string>(value: Record<string, string>, key: K): value is Record<K, string> {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function getDateTimeFormatter(timeZone: string) {
  const cached = dateTimeFormatterCache.get(timeZone);

  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });

  dateTimeFormatterCache.set(timeZone, formatter);
  return formatter;
}

export function resolveTimeZone(timeZone?: string | null) {
  const candidate = timeZone?.trim();

  if (!candidate) {
    return DEFAULT_TIME_ZONE;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

export function parseTimeString(value: string): TimeParts {
  const match = value.match(TIME_STRING_PATTERN);

  if (!match) {
    throw new Error(`Invalid time string: ${value}`);
  }

  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
    second: Number(match[3] ?? "00"),
  };
}

export function timeStringToMinutes(value: string) {
  const { hour, minute } = parseTimeString(value);
  return hour * 60 + minute;
}

export function isPlanningWindowValid(earliestTime: string, latestTime: string) {
  return timeStringToMinutes(latestTime) > timeStringToMinutes(earliestTime);
}

function getZonedDateParts(input: string | Date, timeZone?: string | null): ZonedDateParts {
  const formatter = getDateTimeFormatter(resolveTimeZone(timeZone));
  const parts = formatter.formatToParts(typeof input === "string" ? new Date(input) : input);
  const values: Record<string, string> = {};

  for (const part of parts) {
    if (part.type === "literal") {
      continue;
    }

    values[part.type] = part.value;
  }

  if (
    !hasOwn(values, "year")
    || !hasOwn(values, "month")
    || !hasOwn(values, "day")
    || !hasOwn(values, "hour")
    || !hasOwn(values, "minute")
    || !hasOwn(values, "second")
  ) {
    throw new Error("Unable to derive zoned date parts.");
  }

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function getOffsetMinutesAt(instantMs: number, timeZone?: string | null) {
  const parts = getZonedDateParts(new Date(instantMs), timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((asUtc - instantMs) / 60000);
}

export function getTimeZoneDayKey(input: string | Date, timeZone?: string | null) {
  const parts = getZonedDateParts(input, timeZone);
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function getTimeZoneMinutes(input: string | Date, timeZone?: string | null) {
  const parts = getZonedDateParts(input, timeZone);
  return parts.hour * 60 + parts.minute;
}

export function zonedDateTimeToUtcIso(dayKey: string, time: string, timeZone?: string | null) {
  const [year, month, day] = dayKey.split("-").map(Number);
  const { hour, minute, second } = parseTimeString(time);
  const desiredLocalAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let offsetMinutes = getOffsetMinutesAt(desiredLocalAsUtc, timeZone);
  let instantMs = desiredLocalAsUtc - offsetMinutes * 60000;
  const correctedOffsetMinutes = getOffsetMinutesAt(instantMs, timeZone);

  if (correctedOffsetMinutes !== offsetMinutes) {
    offsetMinutes = correctedOffsetMinutes;
    instantMs = desiredLocalAsUtc - offsetMinutes * 60000;
  }

  return new Date(instantMs).toISOString();
}

export function addDaysToDayKey(dayKey: string, days: number) {
  const [year, month, day] = dayKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return shifted.toISOString().slice(0, 10);
}

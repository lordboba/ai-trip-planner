import { getTimeZoneDayKey, resolveTimeZone } from "@/lib/timezone";

export function formatScheduleDayLabel(iso: string, timeZone?: string | null) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: resolveTimeZone(timeZone),
  }).format(new Date(iso));
}

export function formatScheduleDayKeyLabel(dayKey: string) {
  return formatScheduleDayLabel(`${dayKey}T12:00:00.000Z`, "UTC");
}

export function formatScheduleDateRange(startIso?: string | null, endIso?: string | null, timeZone?: string | null) {
  if (!startIso || !endIso) {
    return "Dates unavailable";
  }

  const resolvedTimeZone = resolveTimeZone(timeZone);
  const start = new Date(startIso);
  const end = new Date(endIso);
  const sameYear = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    timeZone: resolvedTimeZone,
  }).format(start) === new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    timeZone: resolvedTimeZone,
  }).format(end);
  const sameDay = getTimeZoneDayKey(startIso, resolvedTimeZone) === getTimeZoneDayKey(endIso, resolvedTimeZone);

  const startLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: resolvedTimeZone,
  }).format(start);

  const endLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: resolvedTimeZone,
  }).format(end);

  return sameDay ? endLabel : `${startLabel} - ${endLabel}`;
}

export function formatScheduleTimeRange(startIso: string, endIso: string, isAllDay = false, timeZone?: string | null) {
  if (isAllDay) {
    return "All day";
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: resolveTimeZone(timeZone),
  });

  return `${formatter.format(new Date(startIso))} - ${formatter.format(new Date(endIso))}`;
}

export function titleCaseEventType(value: string) {
  return value
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

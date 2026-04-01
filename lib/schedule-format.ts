export function formatScheduleDayLabel(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export function formatScheduleDateRange(startIso?: string | null, endIso?: string | null) {
  if (!startIso || !endIso) {
    return "Dates unavailable";
  }

  const start = new Date(startIso);
  const end = new Date(endIso);
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const sameDay = startIso.slice(0, 10) === endIso.slice(0, 10);

  const startLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "UTC",
  }).format(start);

  const endLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(end);

  return sameDay ? endLabel : `${startLabel} - ${endLabel}`;
}

export function formatScheduleTimeRange(startIso: string, endIso: string, isAllDay = false) {
  if (isAllDay) {
    return "All day";
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });

  return `${formatter.format(new Date(startIso))} - ${formatter.format(new Date(endIso))}`;
}

export function titleCaseEventType(value: string) {
  return value
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

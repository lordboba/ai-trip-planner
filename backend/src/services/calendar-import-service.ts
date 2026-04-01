import {
  importedCalendarSchema,
  normalizedCalendarEventSchema,
  type CityInference,
  type ImportedCalendar,
  type NormalizedCalendarEvent,
  type NormalizedCalendarEventType,
} from "../domain/schedule-plans.ts";

type ParsedProperty = {
  value: string;
  params: Record<string, string>;
};

type RawCalendarEvent = {
  uid?: string;
  summary?: string;
  description?: string;
  location?: string;
  dtstart?: ParsedProperty;
  dtend?: ParsedProperty;
  allDay?: boolean;
};

type KnownCity = {
  city: string;
  region: string | null;
  country: string | null;
  aliases: string[];
};

const KNOWN_CITIES: KnownCity[] = [
  { city: "Austin", region: "TX", country: "USA", aliases: ["austin"] },
  { city: "Boston", region: "MA", country: "USA", aliases: ["boston"] },
  { city: "Chicago", region: "IL", country: "USA", aliases: ["chicago"] },
  { city: "Denver", region: "CO", country: "USA", aliases: ["denver"] },
  { city: "Las Vegas", region: "NV", country: "USA", aliases: ["las vegas", "vegas"] },
  { city: "Lisbon", region: null, country: "Portugal", aliases: ["lisbon"] },
  { city: "London", region: null, country: "United Kingdom", aliases: ["london"] },
  { city: "Los Angeles", region: "CA", country: "USA", aliases: ["los angeles"] },
  { city: "Mexico City", region: null, country: "Mexico", aliases: ["mexico city", "cdmx"] },
  { city: "Miami", region: "FL", country: "USA", aliases: ["miami"] },
  { city: "Nashville", region: "TN", country: "USA", aliases: ["nashville"] },
  { city: "New Orleans", region: "LA", country: "USA", aliases: ["new orleans"] },
  { city: "New York", region: "NY", country: "USA", aliases: ["new york", "nyc", "manhattan", "brooklyn"] },
  { city: "Paris", region: null, country: "France", aliases: ["paris"] },
  { city: "Portland", region: "OR", country: "USA", aliases: ["portland"] },
  { city: "San Diego", region: "CA", country: "USA", aliases: ["san diego"] },
  { city: "San Francisco", region: "CA", country: "USA", aliases: ["san francisco", "sf"] },
  { city: "Seattle", region: "WA", country: "USA", aliases: ["seattle"] },
  { city: "Singapore", region: null, country: "Singapore", aliases: ["singapore"] },
  { city: "Tokyo", region: null, country: "Japan", aliases: ["tokyo"] },
  { city: "Toronto", region: "ON", country: "Canada", aliases: ["toronto"] },
  { city: "Vancouver", region: "BC", country: "Canada", aliases: ["vancouver"] },
];

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9,\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unfoldIcs(input: string) {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\n[ \t]/g, "")
    .trim();
}

function parsePropertyLine(line: string) {
  const separatorIndex = line.indexOf(":");

  if (separatorIndex === -1) {
    return null;
  }

  const left = line.slice(0, separatorIndex);
  const value = line.slice(separatorIndex + 1);
  const [rawName, ...paramParts] = left.split(";");
  const name = rawName.toUpperCase();
  const params: Record<string, string> = {};

  for (const part of paramParts) {
    const [key, ...rawPieces] = part.split("=");
    if (!key || rawPieces.length === 0) {
      continue;
    }

    params[key.toUpperCase()] = rawPieces.join("=");
  }

  return { name, value, params };
}

function parseIcsDate(value: string, params: Record<string, string>) {
  const trimmed = value.trim();
  const isAllDay = params.VALUE === "DATE" || /^\d{8}$/.test(trimmed);
  const timezone = params.TZID?.trim() || null;

  if (isAllDay) {
    const year = Number(trimmed.slice(0, 4));
    const month = Number(trimmed.slice(4, 6));
    const day = Number(trimmed.slice(6, 8));
    const iso = new Date(Date.UTC(year, month - 1, day, 0, 0, 0)).toISOString();
    return { iso, isAllDay: true, timezone };
  }

  const match = trimmed.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/,
  );

  if (!match) {
    throw new Error(`Unsupported ICS date value: ${trimmed}`);
  }

  const [, year, month, day, hour, minute, second = "00", zulu] = match;
  const iso = zulu
    ? new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`).toISOString()
    : new Date(Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    )).toISOString();

  return { iso, isAllDay: false, timezone };
}

function parseIcsEvents(icsText: string) {
  const lines = unfoldIcs(icsText).split("\n");
  const events: RawCalendarEvent[] = [];
  const warnings: string[] = [];
  let current: RawCalendarEvent | null = null;
  let calendarTimezone: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    if (trimmed === "BEGIN:VEVENT") {
      current = {};
      continue;
    }

    if (trimmed === "END:VEVENT") {
      if (current?.dtstart) {
        events.push(current);
      } else {
        warnings.push("Skipped one calendar event because it did not have a DTSTART value.");
      }
      current = null;
      continue;
    }

    const property = parsePropertyLine(trimmed);

    if (!property) {
      continue;
    }

    if (property.name === "X-WR-TIMEZONE") {
      calendarTimezone = property.value.trim();
      continue;
    }

    if (!current) {
      continue;
    }

    switch (property.name) {
      case "UID":
        current.uid = property.value.trim();
        break;
      case "SUMMARY":
        current.summary = property.value.trim();
        break;
      case "DESCRIPTION":
        current.description = property.value.replace(/\\n/g, "\n").trim();
        break;
      case "LOCATION":
        current.location = property.value.replace(/\\,/g, ",").trim();
        break;
      case "DTSTART":
        current.dtstart = { value: property.value, params: property.params };
        break;
      case "DTEND":
        current.dtend = { value: property.value, params: property.params };
        break;
      case "X-MICROSOFT-CDO-ALLDAYEVENT":
        current.allDay = property.value.trim().toUpperCase() === "TRUE";
        break;
      default:
        break;
    }
  }

  return { events, warnings, calendarTimezone };
}

function classifyEventType(title: string, description: string, location: string | null): NormalizedCalendarEventType {
  const haystack = `${title} ${description} ${location ?? ""}`.toLowerCase();

  if (/(flight|depart|arrival|boarding|airport|airlines?)/.test(haystack)) return "flight";
  if (/(hotel|check-in|check in|checkout|check-out|lodging)/.test(haystack)) return "hotel";
  if (/(lunch|dinner|breakfast|brunch|coffee|meal|restaurant)/.test(haystack)) return "meal";
  if (/(commute|uber|lyft|taxi|train|transit|transfer)/.test(haystack)) return "commute";
  if (/(focus|work block|deep work|heads down)/.test(haystack)) return "focus";
  if (/(hold|blocked|ooo|out of office)/.test(haystack)) return "hold";
  if (/(meeting|sync|call|1:1|review|onsite|presentation|workshop)/.test(haystack)) return "meeting";

  return "other";
}

function fallbackCityFromLocation(text: string) {
  const segments = text
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length < 2) {
    return null;
  }

  const candidate = segments[segments.length - 2];

  if (!candidate || /\d/.test(candidate)) {
    return null;
  }

  return candidate;
}

function inferCityFromTexts(texts: string[]): CityInference {
  const scores = new Map<string, { city: KnownCity; score: number; signals: string[] }>();

  for (const rawText of texts) {
    const text = normalizeText(rawText);

    if (!text) {
      continue;
    }

    for (const knownCity of KNOWN_CITIES) {
      if (!knownCity.aliases.some((alias) => text.includes(alias))) {
        continue;
      }

      const existing = scores.get(knownCity.city) ?? {
        city: knownCity,
        score: 0,
        signals: [],
      };
      existing.score += 1;
      existing.signals.push(rawText);
      scores.set(knownCity.city, existing);
    }
  }

  const ranked = [...scores.values()].sort((left, right) => right.score - left.score);

  if (ranked[0]) {
    const winner = ranked[0];
    const confidence = Math.min(0.95, 0.45 + winner.score * 0.18);

    return {
      city: winner.city.city,
      region: winner.city.region,
      country: winner.city.country,
      confidence,
      matchedFrom: winner.signals.slice(0, 4),
    };
  }

  for (const rawText of texts) {
    const fallback = fallbackCityFromLocation(rawText);

    if (fallback) {
      return {
        city: fallback,
        region: null,
        country: null,
        confidence: 0.36,
        matchedFrom: [rawText],
      };
    }
  }

  return {
    city: null,
    region: null,
    country: null,
    confidence: 0,
    matchedFrom: [],
  };
}

function sortEvents(events: readonly NormalizedCalendarEvent[]) {
  return [...events].sort((left, right) => (
    left.startsAt.localeCompare(right.startsAt) || left.endsAt.localeCompare(right.endsAt)
  ));
}

function normalizeRawEvent(rawEvent: RawCalendarEvent, defaultTimezone: string | null): NormalizedCalendarEvent {
  if (!rawEvent.dtstart) {
    throw new Error("Calendar event missing DTSTART");
  }

  const start = parseIcsDate(rawEvent.dtstart.value, rawEvent.dtstart.params);
  const end = rawEvent.dtend
    ? parseIcsDate(rawEvent.dtend.value, rawEvent.dtend.params)
    : {
      iso: new Date(
        Date.parse(start.iso) + (start.isAllDay || rawEvent.allDay ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000),
      ).toISOString(),
      isAllDay: start.isAllDay,
      timezone: start.timezone,
    };

  const title = rawEvent.summary?.trim() || "Untitled event";
  const description = rawEvent.description?.trim() || "";
  const location = rawEvent.location?.trim() || null;
  const cityInference = inferCityFromTexts([location ?? "", title, description]);

  return normalizedCalendarEventSchema.parse({
    id: crypto.randomUUID(),
    source: "ics",
    sourceEventId: rawEvent.uid?.trim() || undefined,
    title,
    description,
    location,
    startsAt: start.iso,
    endsAt: end.iso,
    isAllDay: rawEvent.allDay ?? start.isAllDay,
    timezone: start.timezone ?? end.timezone ?? defaultTimezone,
    type: classifyEventType(title, description, location),
    inferredCity: cityInference.city,
    locked: true,
  });
}

export function inferCalendarCity(events: readonly NormalizedCalendarEvent[]) {
  return inferCityFromTexts(
    events.flatMap((event) => [event.location ?? "", event.title, event.description]).filter(Boolean),
  );
}

function filterEventsByDateRange(
  events: readonly NormalizedCalendarEvent[],
  startDate: string | null,
  endDate: string | null,
): NormalizedCalendarEvent[] {
  if (!startDate || !endDate) return [...events];
  const rangeStart = `${startDate}T00:00:00.000Z`;
  const rangeEnd = `${endDate}T23:59:59.999Z`;
  return events.filter(
    (event) => event.endsAt > rangeStart && event.startsAt <= rangeEnd,
  );
}

export function importCalendarFromIcsText(input: {
  icsText: string;
  source?: "ics" | "google";
  startDate?: string | null;
  endDate?: string | null;
}) {
  const { events: rawEvents, warnings, calendarTimezone } = parseIcsEvents(input.icsText);
  const normalizedEvents = sortEvents(
    rawEvents.map((rawEvent) => normalizeRawEvent(rawEvent, calendarTimezone)),
  );
  const filteredEvents = filterEventsByDateRange(
    normalizedEvents,
    input.startDate ?? null,
    input.endDate ?? null,
  );
  const cityInference = inferCalendarCity(filteredEvents);

  return importedCalendarSchema.parse({
    source: input.source ?? "ics",
    importedAt: new Date().toISOString(),
    timezone: calendarTimezone,
    cityInference,
    warnings: filteredEvents.length > 0
      ? warnings
      : [...warnings, "No VEVENT entries were found in the uploaded calendar file."],
    events: filteredEvents,
  }) satisfies ImportedCalendar;
}

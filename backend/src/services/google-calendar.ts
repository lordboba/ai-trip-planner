import { z } from "zod";
import {
  importedCalendarSchema,
  normalizedCalendarEventSchema,
  type ImportedCalendar,
  type NormalizedCalendarEvent,
} from "../domain/schedule-plans.ts";
import { inferCalendarCity } from "./calendar-import-service.ts";

const googleCalendarDateSchema = z.object({
  date: z.string().optional(),
  dateTime: z.string().optional(),
  timeZone: z.string().optional(),
});

const googleCalendarEventSchema = z.object({
  id: z.string(),
  summary: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  start: googleCalendarDateSchema,
  end: googleCalendarDateSchema.optional(),
});

const googleCalendarListEventsSchema = z.object({
  items: z.array(googleCalendarEventSchema).default([]),
  timeZone: z.string().optional(),
});

const googleEventTypeMatchers: Array<[RegExp, NormalizedCalendarEvent["type"]]> = [
  [/(flight|depart|arrival|boarding|airport|airlines?)/i, "flight"],
  [/(hotel|check-in|check in|checkout|check-out|lodging)/i, "hotel"],
  [/(lunch|dinner|breakfast|brunch|coffee|meal|restaurant)/i, "meal"],
  [/(commute|uber|lyft|taxi|train|transit|transfer)/i, "commute"],
  [/(focus|work block|deep work|heads down)/i, "focus"],
  [/(hold|blocked|ooo|out of office)/i, "hold"],
  [/(meeting|sync|call|1:1|review|onsite|presentation|workshop)/i, "meeting"],
];

function classifyGoogleEventType(title: string, description: string, location: string | null): NormalizedCalendarEvent["type"] {
  const haystack = `${title} ${description} ${location ?? ""}`;

  for (const [matcher, type] of googleEventTypeMatchers) {
    if (matcher.test(haystack)) {
      return type;
    }
  }

  return "other";
}

function parseGoogleDate(date: z.infer<typeof googleCalendarDateSchema>) {
  if (date.dateTime) {
    return {
      iso: new Date(date.dateTime).toISOString(),
      allDay: false,
      timezone: date.timeZone ?? null,
    };
  }

  if (date.date) {
    const iso = new Date(`${date.date}T00:00:00.000Z`).toISOString();
    return {
      iso,
      allDay: true,
      timezone: date.timeZone ?? null,
    };
  }

  throw new Error("Google Calendar event date is missing.");
}

function normalizeGoogleEvents(events: z.infer<typeof googleCalendarEventSchema>[]) {
  const normalized: NormalizedCalendarEvent[] = [];

  for (const event of events) {
    const start = parseGoogleDate(event.start);
    const end = event.end ? parseGoogleDate(event.end) : null;
    const title = event.summary?.trim() || "Untitled event";
    const description = event.description?.trim() || "";
    const location = event.location?.trim() || null;

    normalized.push(normalizedCalendarEventSchema.parse({
      id: `google-${event.id}`,
      source: "google",
      sourceEventId: event.id,
      title,
      description,
      location,
      startsAt: start.iso,
      endsAt: end?.iso ?? start.iso,
      isAllDay: start.allDay,
      timezone: start.timezone,
      type: classifyGoogleEventType(title, description, location),
      locked: true,
    }));
  }

  return normalized.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

export async function importCalendarFromGoogleEvents(input: {
  accessToken: string;
  startDate?: string | null;
  endDate?: string | null;
}): Promise<ImportedCalendar> {
  const startDate = input.startDate ?? null;
  const endDate = input.endDate ?? null;

  const timeMin = startDate ? `${startDate}T00:00:00.000Z` : undefined;
  const timeMax = endDate ? `${endDate}T23:59:59.999Z` : undefined;

  const params = new URLSearchParams({
    maxResults: "2500",
    singleEvents: "true",
    orderBy: "startTime",
  });

  if (timeMin) params.set("timeMin", timeMin);
  if (timeMax) params.set("timeMax", timeMax);

  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Google Calendar events request failed with status ${response.status}.`);
  }

  const payload = googleCalendarListEventsSchema.parse(await response.json());
  const normalizedEvents = normalizeGoogleEvents(payload.items);
  const cityInference = inferCalendarCity(normalizedEvents);

  return importedCalendarSchema.parse({
    source: "google",
    importedAt: new Date().toISOString(),
    timezone: payload.timeZone ?? null,
    cityInference,
    warnings: normalizedEvents.length === 0 ? ["No Google Calendar events were found for the selected date range."] : [],
    events: normalizedEvents,
  });
}

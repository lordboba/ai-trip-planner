import {
  schedulePlanSchema,
  schedulePlanRequestSchema,
  type ImportedCalendar,
  type NormalizedCalendarEvent,
  type ScheduleGapKind,
  type SchedulePlan,
  type SchedulePlanPreferences,
  type SchedulePlanRequest,
  type ScheduleSlot,
  type ScheduleSuggestion,
  type ScheduleTripContext,
} from "../domain/schedule-plans.ts";
import { getStoredSchedulePlan, saveSchedulePlan } from "../store/schedule-plan-store.ts";

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 21;

const INTEREST_PROFILES = {
  food: { category: "meal", venueHint: "A reliable local table with fast service.", quickStopTitle: "Coffee or snack reset" },
  nightlife: { category: "bar", venueHint: "A low-commitment cocktail spot close to your route.", quickStopTitle: "Short cocktail detour" },
  nature: { category: "walk", venueHint: "A nearby outdoor reset with minimal transit.", quickStopTitle: "Fresh-air walk" },
  culture: { category: "culture", venueHint: "A compact museum, gallery, or design stop nearby.", quickStopTitle: "Culture micro-stop" },
  shopping: { category: "shopping", venueHint: "A short browse in a walkable retail pocket.", quickStopTitle: "Browse window" },
  wellness: { category: "wellness", venueHint: "A calm cafe, tea room, or recharge spot nearby.", quickStopTitle: "Recharge reset" },
  adventure: { category: "viewpoint", venueHint: "A high-signal local stop worth the detour.", quickStopTitle: "Scenic detour" },
  "family-friendly": { category: "easy activity", venueHint: "A low-friction stop that stays flexible.", quickStopTitle: "Easy flexible stop" },
  "hidden gems": { category: "neighborhood", venueHint: "A neighborhood-first spot that feels less obvious.", quickStopTitle: "Neighborhood drift" },
} as const;

function sortEvents(events: readonly NormalizedCalendarEvent[]) {
  return [...events].sort((left, right) => (
    left.startsAt.localeCompare(right.startsAt) || left.endsAt.localeCompare(right.endsAt)
  ));
}

function isoDayKey(iso: string) {
  return iso.slice(0, 10);
}

function parseIso(iso: string) {
  return new Date(iso);
}

function minutesBetween(startIso: string, endIso: string) {
  return Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60000);
}

function sameDay(startIso: string, endIso: string) {
  return isoDayKey(startIso) === isoDayKey(endIso);
}

function setDayTime(dayKey: string, hour: number, minute = 0) {
  return new Date(`${dayKey}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`).toISOString();
}

function unique<T>(items: readonly T[]) {
  return [...new Set(items)];
}

function deriveTripContext(importedSchedule: ImportedCalendar): ScheduleTripContext {
  const timeline = sortEvents(importedSchedule.events);
  const tripStart = timeline[0]?.startsAt ?? null;
  const tripEnd = timeline.at(-1)?.endsAt ?? null;
  const travelDayCount = unique(
    timeline.flatMap((event) => {
      const startDay = isoDayKey(event.startsAt);
      const endDay = isoDayKey(event.endsAt);
      return startDay === endDay ? [startDay] : [startDay, endDay];
    }),
  ).length;

  return {
    cityInference: importedSchedule.cityInference,
    timezone: importedSchedule.timezone,
    tripStart,
    tripEnd,
    totalEvents: timeline.length,
    travelDayCount,
  };
}

function overlapsMealWindow(startIso: string, endIso: string) {
  const start = parseIso(startIso);
  const end = parseIso(endIso);
  const startMinutes = start.getUTCHours() * 60 + start.getUTCMinutes();
  const endMinutes = end.getUTCHours() * 60 + end.getUTCMinutes();
  const lunch = startMinutes < 14 * 60 + 30 && endMinutes > 11 * 60 + 30;
  const dinner = startMinutes < 20 * 60 + 30 && endMinutes > 17 * 60 + 30;
  return lunch || dinner;
}

function buildSlot(params: {
  startsAt: string;
  endsAt: string;
  city: string | null;
  previousEventId?: string | null;
  nextEventId?: string | null;
}): ScheduleSlot | null {
  const durationMinutes = minutesBetween(params.startsAt, params.endsAt);

  if (durationMinutes < 20 || durationMinutes > 240) {
    return null;
  }

  const kind: ScheduleGapKind = durationMinutes >= 45 && overlapsMealWindow(params.startsAt, params.endsAt)
    ? "meal-window"
    : "quick-stop";

  return {
    id: crypto.randomUUID(),
    kind,
    label: kind === "meal-window" ? "Meal window" : "Quick stop",
    startsAt: params.startsAt,
    endsAt: params.endsAt,
    durationMinutes,
    city: params.city,
    previousEventId: params.previousEventId ?? null,
    nextEventId: params.nextEventId ?? null,
  };
}

function detectScheduleSlots(importedSchedule: ImportedCalendar) {
  const blockingEvents = sortEvents(
    importedSchedule.events.filter((event) => !event.isAllDay && event.type !== "hotel"),
  );
  const slots: ScheduleSlot[] = [];
  const eventsByDay = new Map<string, NormalizedCalendarEvent[]>();

  for (const event of blockingEvents) {
    const dayKey = isoDayKey(event.startsAt);
    const dayEvents = eventsByDay.get(dayKey) ?? [];
    dayEvents.push(event);
    eventsByDay.set(dayKey, dayEvents);
  }

  for (const [dayKey, dayEvents] of eventsByDay.entries()) {
    const sortedDayEvents = sortEvents(dayEvents);
    const firstEvent = sortedDayEvents[0];
    const lastEvent = sortedDayEvents.at(-1);

    if (firstEvent) {
      const morningSlot = buildSlot({
        startsAt: setDayTime(dayKey, DAY_START_HOUR),
        endsAt: firstEvent.startsAt,
        city: firstEvent.inferredCity ?? importedSchedule.cityInference.city,
        previousEventId: null,
        nextEventId: firstEvent.id,
      });

      if (morningSlot) {
        slots.push(morningSlot);
      }
    }

    for (let index = 0; index < sortedDayEvents.length - 1; index += 1) {
      const current = sortedDayEvents[index];
      const next = sortedDayEvents[index + 1];

      if (!sameDay(current.endsAt, next.startsAt)) {
        continue;
      }

      const slot = buildSlot({
        startsAt: current.endsAt,
        endsAt: next.startsAt,
        city: current.inferredCity ?? next.inferredCity ?? importedSchedule.cityInference.city,
        previousEventId: current.id,
        nextEventId: next.id,
      });

      if (slot) {
        slots.push(slot);
      }
    }

    if (lastEvent) {
      const eveningSlot = buildSlot({
        startsAt: lastEvent.endsAt,
        endsAt: setDayTime(dayKey, DAY_END_HOUR),
        city: lastEvent.inferredCity ?? importedSchedule.cityInference.city,
        previousEventId: lastEvent.id,
        nextEventId: null,
      });

      if (eveningSlot) {
        slots.push(eveningSlot);
      }
    }
  }

  return sortSlots(slots);
}

function sortSlots(slots: readonly ScheduleSlot[]) {
  return [...slots].sort((left, right) => left.startsAt.localeCompare(right.startsAt));
}

function primaryInterest(preferences: SchedulePlanPreferences) {
  for (const interest of preferences.interests) {
    if (interest in INTEREST_PROFILES) {
      return interest as keyof typeof INTEREST_PROFILES;
    }
  }

  return "hidden gems";
}

function formatCost(preferences: SchedulePlanPreferences, kind: ScheduleGapKind) {
  if (kind === "meal-window") {
    if (preferences.budgetBand === "lean") return "$ to $$";
    if (preferences.budgetBand === "luxury") return "$$$";
    return "$$";
  }

  if (preferences.budgetBand === "lean") return "$";
  if (preferences.budgetBand === "luxury") return "$$ to $$$";
  return "$$";
}

function transportNote(preferences: SchedulePlanPreferences, slot: ScheduleSlot) {
  if (preferences.transport === "walk") {
    return "Keep it walkable so the return path stays low-risk.";
  }

  if (preferences.transport === "transit") {
    return slot.durationMinutes >= 60
      ? "A short transit hop still fits if the stop stays close to the line."
      : "Stay on the same transit spine to avoid burning the gap.";
  }

  if (preferences.transport === "rideshare") {
    return "This works best as one direct rideshare out and back.";
  }

  if (preferences.transport === "rental-car") {
    return "Choose something with easy parking and a clean exit.";
  }

  return "Keep the routing tight so the gap still feels comfortable.";
}

function suggestionWindow(slot: ScheduleSlot, preferredMinutes: number) {
  const slotStart = Date.parse(slot.startsAt);
  const slotEnd = Date.parse(slot.endsAt);
  const duration = Math.min(preferredMinutes, slot.durationMinutes);
  const padding = Math.max(0, Math.floor((slot.durationMinutes - duration) / 2));
  const start = new Date(slotStart + padding * 60000).toISOString();
  const end = new Date(Math.min(slotEnd, Date.parse(start) + duration * 60000)).toISOString();
  return { startsAt: start, endsAt: end, durationMinutes: minutesBetween(start, end) };
}

function labelForGap(slot: ScheduleSlot) {
  const start = parseIso(slot.startsAt);
  const startMinutes = start.getUTCHours() * 60 + start.getUTCMinutes();

  if (slot.kind !== "meal-window") {
    return "Quick stop";
  }

  if (startMinutes < 15 * 60) {
    return "Lunch window";
  }

  return "Dinner window";
}

function generateSuggestions(
  importedSchedule: ImportedCalendar,
  preferences: SchedulePlanPreferences,
  slots: readonly ScheduleSlot[],
) {
  const interest = primaryInterest(preferences);
  const profile = INTEREST_PROFILES[interest];
  const timeline = sortEvents(importedSchedule.events);
  const timelineById = new Map(timeline.map((event) => [event.id, event]));

  return slots.map((slot) => {
    const previousEvent = slot.previousEventId ? timelineById.get(slot.previousEventId) ?? null : null;
    const nextEvent = slot.nextEventId ? timelineById.get(slot.nextEventId) ?? null : null;
    const areaLabel = slot.city ?? importedSchedule.cityInference.city ?? "your route";
    const gapLabel = labelForGap(slot);
    const window = suggestionWindow(slot, slot.kind === "meal-window" ? 60 : 35);
    const title = slot.kind === "meal-window"
      ? `${gapLabel} near ${areaLabel}`
      : `${profile.quickStopTitle} in ${areaLabel}`;
    const subtitle = `${slot.durationMinutes} min open gap`;
    const betweenCopy = previousEvent && nextEvent
      ? `between ${previousEvent.title} and ${nextEvent.title}`
      : previousEvent
        ? `after ${previousEvent.title}`
        : nextEvent
          ? `before ${nextEvent.title}`
          : "in your current schedule";
    const message = slot.kind === "meal-window"
      ? `You have a clean ${slot.durationMinutes}-minute meal window ${betweenCopy}. This keeps the plan grounded without forcing a long detour.`
      : `You have ${slot.durationMinutes} open minutes ${betweenCopy}. This fits a low-friction ${profile.category} stop instead of a full reroute.`;

    return {
      id: crypto.randomUUID(),
      slotId: slot.id,
      status: "pending",
      title,
      subtitle,
      message: preferences.comments.trim()
        ? `${message} Notes applied: ${preferences.comments.trim()}`
        : message,
      category: slot.kind === "meal-window" ? "meal" : profile.category,
      venueHint: slot.kind === "meal-window"
        ? "Look for a place with predictable service and a short sit-down cycle."
        : profile.venueHint,
      estimatedCost: formatCost(preferences, slot.kind),
      estimatedDurationMinutes: window.durationMinutes,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      transitNote: transportNote(preferences, slot),
      actionLabel: "Add to timeline",
      addedEventId: null,
    } satisfies ScheduleSuggestion;
  });
}

function buildSchedulePlan(request: SchedulePlanRequest): SchedulePlan {
  const tripContext = deriveTripContext(request.importedSchedule);
  const slots = detectScheduleSlots(request.importedSchedule);
  const suggestions = generateSuggestions(request.importedSchedule, request.preferences, slots);

  return schedulePlanSchema.parse({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    request,
    tripContext,
    slots,
    suggestions,
    timeline: sortEvents(request.importedSchedule.events),
  });
}

export async function createSchedulePlan(request: SchedulePlanRequest) {
  const parsed = schedulePlanRequestSchema.parse(request);
  const stored = buildSchedulePlan(parsed);
  return saveSchedulePlan(stored);
}

export function getSchedulePlanById(planId: string) {
  return getStoredSchedulePlan(planId);
}

export async function addSuggestionToSchedulePlan(planId: string, suggestionId: string) {
  const existing = getStoredSchedulePlan(planId);

  if (!existing) {
    return null;
  }

  const suggestion = existing.suggestions.find((entry) => entry.id === suggestionId);

  if (!suggestion) {
    return null;
  }

  if (suggestion.status === "added" && suggestion.addedEventId) {
    return existing;
  }

  const addedEvent: NormalizedCalendarEvent = {
    id: crypto.randomUUID(),
    source: existing.request.importedSchedule.source,
    title: suggestion.title,
    description: suggestion.message,
    location: suggestion.venueHint,
    startsAt: suggestion.startsAt,
    endsAt: suggestion.endsAt,
    isAllDay: false,
    timezone: existing.tripContext.timezone,
    type: suggestion.category === "meal" ? "meal" : "other",
    inferredCity: existing.tripContext.cityInference.city,
    locked: false,
  };

  const updated = schedulePlanSchema.parse({
    ...existing,
    suggestions: existing.suggestions.map((entry) => (
      entry.id === suggestionId
        ? { ...entry, status: "added", addedEventId: addedEvent.id }
        : entry
    )),
    timeline: sortEvents([...existing.timeline, addedEvent]),
  });

  return saveSchedulePlan(updated);
}

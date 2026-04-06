import { z } from "zod";
import type { BudgetBand, GenerationMetadata, PlaceCandidate } from "../domain/planning.ts";
import {
  schedulePlanSchema,
  schedulePlanRequestSchema,
  type ImportedCalendar,
  type NormalizedCalendarEvent,
  type ScheduleGapKind,
  type SchedulePlan,
  type SchedulePlanPreferences,
  type SchedulePlanRequest,
  type SchedulePlanWorkflow,
  type ScheduleSlot,
  type ScheduleSuggestion,
  type ScheduleTripContext,
  type ScheduleWorkflowStep,
  type ScheduleWorkflowStepResult,
} from "../domain/schedule-plans.ts";
import { getStoredSchedulePlan, saveSchedulePlan } from "../store/schedule-plan-store.ts";
import { runPlanningStep } from "./ai/run-planning-step.ts";
import { fetchSlotPlaceCandidates } from "./google-places.ts";
import {
  getTimeZoneDayKey,
  getTimeZoneMinutes,
  resolveTimeZone,
  zonedDateTimeToUtcIso,
} from "../../../lib/timezone.ts";

const MEAL_WINDOWS = [
  { label: "Breakfast window", startsAtMinutes: 7 * 60, endsAtMinutes: 10 * 60 + 30 },
  { label: "Lunch window", startsAtMinutes: 11 * 60 + 30, endsAtMinutes: 14 * 60 + 30 },
  { label: "Dinner window", startsAtMinutes: 17 * 60, endsAtMinutes: 20 * 60 + 30 },
] as const;

const INTEREST_PROFILES = {
  food: {
    category: "cafe",
    title: "Coffee reset",
    venueHint: "A polished coffee or casual dining stop close to the route.",
    queries: ["coffee", "bakery"],
  },
  nightlife: {
    category: "bar",
    title: "Short cocktail detour",
    venueHint: "A moody but efficient bar with a quick in-and-out rhythm.",
    queries: ["cocktail bar", "wine bar"],
  },
  nature: {
    category: "park",
    title: "Fresh-air walk",
    venueHint: "A short outdoor reset that avoids a big detour.",
    queries: ["park", "scenic walk"],
  },
  culture: {
    category: "gallery",
    title: "Culture micro-stop",
    venueHint: "A compact gallery, museum, or design stop nearby.",
    queries: ["gallery", "museum"],
  },
  shopping: {
    category: "boutique",
    title: "Browse window",
    venueHint: "A walkable cluster of shops that stays flexible.",
    queries: ["boutique", "design store"],
  },
  wellness: {
    category: "tea house",
    title: "Recharge reset",
    venueHint: "A calm, restorative stop that stays low-friction.",
    queries: ["tea house", "quiet cafe"],
  },
  adventure: {
    category: "viewpoint",
    title: "Scenic detour",
    venueHint: "A high-signal stop with payoff without burning the whole gap.",
    queries: ["viewpoint", "landmark"],
  },
  "hidden gems": {
    category: "neighborhood",
    title: "Neighborhood drift",
    venueHint: "A less obvious local spot that still fits the route.",
    queries: ["hidden gem", "neighborhood spot"],
  },
} as const;

const diningAgentOutputSchema = z.object({
  strategy: z.string(),
  selections: z.array(z.object({
    slotId: z.string(),
    selectedName: z.string(),
    rationale: z.string(),
  })),
});

const itineraryAgentOutputSchema = z.object({
  rhythm: z.string(),
  suggestions: z.array(z.object({
    slotId: z.string(),
    selectedName: z.string(),
    title: z.string(),
    subtitle: z.string(),
    message: z.string(),
    transitNote: z.string(),
    estimatedDurationMinutes: z.number().int().positive(),
  })),
});

const budgetAgentOutputSchema = z.object({
  fitsBudget: z.boolean(),
  summary: z.string(),
  adjustments: z.array(z.object({
    slotId: z.string(),
    approvedName: z.string(),
    rationale: z.string(),
  })),
});

type SlotContext = {
  slot: ScheduleSlot;
  previousEvent: NormalizedCalendarEvent | null;
  nextEvent: NormalizedCalendarEvent | null;
  timeZone: string;
  areaLabel: string;
  betweenCopy: string;
  gapLabel: string;
};

type SlotCandidateResolution = {
  context: SlotContext;
  candidates: PlaceCandidate[];
  placesLive: boolean;
  placesReason: string | null;
  usedFallbackCandidates: boolean;
};

type ItineraryDraft = z.infer<typeof itineraryAgentOutputSchema>["suggestions"][number];

function sortEvents(events: readonly NormalizedCalendarEvent[]) {
  return [...events].sort((left, right) => (
    left.startsAt.localeCompare(right.startsAt) || left.endsAt.localeCompare(right.endsAt)
  ));
}

function minutesBetween(startIso: string, endIso: string) {
  return Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60000);
}

function unique<T>(items: readonly T[]) {
  return [...new Set(items)];
}

function deriveTripContext(importedSchedule: ImportedCalendar): ScheduleTripContext {
  const timeline = sortEvents(importedSchedule.events);
  const tripStart = timeline[0]?.startsAt ?? null;
  const tripEnd = timeline.at(-1)?.endsAt ?? null;
  const timezone = importedSchedule.timezone ?? timeline.find((event) => event.timezone)?.timezone ?? null;
  const travelDayCount = unique(
    timeline.flatMap((event) => {
      const startDay = getTimeZoneDayKey(event.startsAt, timezone);
      const endDay = getTimeZoneDayKey(event.endsAt, timezone);
      return startDay === endDay ? [startDay] : [startDay, endDay];
    }),
  ).length;

  return {
    cityInference: importedSchedule.cityInference,
    timezone,
    tripStart,
    tripEnd,
    totalEvents: timeline.length,
    travelDayCount,
  };
}

function planningTimeZone(importedSchedule: ImportedCalendar) {
  return resolveTimeZone(importedSchedule.timezone ?? importedSchedule.events.find((event) => event.timezone)?.timezone);
}

function overlapsRange(startMinutes: number, endMinutes: number, rangeStartMinutes: number, rangeEndMinutes: number) {
  return startMinutes < rangeEndMinutes && endMinutes > rangeStartMinutes;
}

function overlapsMealWindow(startIso: string, endIso: string, timeZone: string) {
  const startMinutes = getTimeZoneMinutes(startIso, timeZone);
  const endMinutes = getTimeZoneMinutes(endIso, timeZone);
  return MEAL_WINDOWS.some((window) => (
    overlapsRange(startMinutes, endMinutes, window.startsAtMinutes, window.endsAtMinutes)
  ));
}

function mealLabelForSlot(slot: ScheduleSlot, timeZone: string) {
  const startMinutes = getTimeZoneMinutes(slot.startsAt, timeZone);
  const endMinutes = getTimeZoneMinutes(slot.endsAt, timeZone);
  const midpointMinutes = startMinutes + Math.max(0, Math.floor((endMinutes - startMinutes) / 2));
  const containingWindow = MEAL_WINDOWS.find((window) => (
    midpointMinutes >= window.startsAtMinutes && midpointMinutes < window.endsAtMinutes
  ));

  if (containingWindow) {
    return containingWindow.label;
  }

  const overlappingWindow = MEAL_WINDOWS.find((window) => (
    overlapsRange(startMinutes, endMinutes, window.startsAtMinutes, window.endsAtMinutes)
  ));

  return overlappingWindow?.label ?? "Meal window";
}

function clampSlotToPlanningWindow(
  startsAt: string,
  endsAt: string,
  dayKey: string,
  earliestTime: string,
  latestTime: string,
  timeZone: string,
) {
  const windowStart = zonedDateTimeToUtcIso(dayKey, `${earliestTime}:00`, timeZone);
  const windowEnd = zonedDateTimeToUtcIso(dayKey, `${latestTime}:00`, timeZone);
  return {
    startsAt: Date.parse(startsAt) > Date.parse(windowStart) ? startsAt : windowStart,
    endsAt: Date.parse(endsAt) < Date.parse(windowEnd) ? endsAt : windowEnd,
  };
}

function buildSlot(params: {
  startsAt: string;
  endsAt: string;
  city: string | null;
  timeZone: string;
  previousEventId?: string | null;
  nextEventId?: string | null;
}): ScheduleSlot | null {
  const durationMinutes = minutesBetween(params.startsAt, params.endsAt);

  if (durationMinutes < 20 || durationMinutes > 240) {
    return null;
  }

  const kind: ScheduleGapKind = durationMinutes >= 45 && overlapsMealWindow(params.startsAt, params.endsAt, params.timeZone)
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

function detectScheduleSlots(importedSchedule: ImportedCalendar, preferences: SchedulePlanPreferences) {
  const blockingEvents = sortEvents(
    importedSchedule.events.filter((event) => !event.isAllDay && event.type !== "hotel"),
  );
  const slots: ScheduleSlot[] = [];
  const eventsByDay = new Map<string, NormalizedCalendarEvent[]>();
  const timeZone = planningTimeZone(importedSchedule);

  for (const event of blockingEvents) {
    const dayKey = getTimeZoneDayKey(event.startsAt, timeZone);
    const dayEvents = eventsByDay.get(dayKey) ?? [];
    dayEvents.push(event);
    eventsByDay.set(dayKey, dayEvents);
  }

  for (const [dayKey, dayEvents] of eventsByDay.entries()) {
    const sortedDayEvents = sortEvents(dayEvents);
    const firstEvent = sortedDayEvents[0];
    const lastEvent = sortedDayEvents.at(-1);

    if (firstEvent) {
      const morningBounds = clampSlotToPlanningWindow(
        zonedDateTimeToUtcIso(dayKey, `${preferences.earliestTime}:00`, timeZone),
        firstEvent.startsAt,
        dayKey,
        preferences.earliestTime,
        preferences.latestTime,
        timeZone,
      );
      const morningSlot = buildSlot({
        startsAt: morningBounds.startsAt,
        endsAt: morningBounds.endsAt,
        city: firstEvent.inferredCity ?? importedSchedule.cityInference.city,
        timeZone,
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

      if (getTimeZoneDayKey(current.endsAt, timeZone) !== getTimeZoneDayKey(next.startsAt, timeZone)) {
        continue;
      }

      const clampedGap = clampSlotToPlanningWindow(
        current.endsAt,
        next.startsAt,
        dayKey,
        preferences.earliestTime,
        preferences.latestTime,
        timeZone,
      );
      const slot = buildSlot({
        startsAt: clampedGap.startsAt,
        endsAt: clampedGap.endsAt,
        city: current.inferredCity ?? next.inferredCity ?? importedSchedule.cityInference.city,
        timeZone,
        previousEventId: current.id,
        nextEventId: next.id,
      });

      if (slot) {
        slots.push(slot);
      }
    }

    if (lastEvent) {
      const eveningBounds = clampSlotToPlanningWindow(
        lastEvent.endsAt,
        zonedDateTimeToUtcIso(dayKey, `${preferences.latestTime}:00`, timeZone),
        dayKey,
        preferences.earliestTime,
        preferences.latestTime,
        timeZone,
      );
      const eveningSlot = buildSlot({
        startsAt: eveningBounds.startsAt,
        endsAt: eveningBounds.endsAt,
        city: lastEvent.inferredCity ?? importedSchedule.cityInference.city,
        timeZone,
        previousEventId: lastEvent.id,
        nextEventId: null,
      });

      if (eveningSlot) {
        slots.push(eveningSlot);
      }
    }
  }

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

function priceBandScore(priceBand: string) {
  const count = (priceBand.match(/\$/g) ?? []).length;
  return count > 0 ? count : 2;
}

function isBudgetFit(place: PlaceCandidate, budgetBand: BudgetBand) {
  const score = priceBandScore(place.priceBand);

  if (budgetBand === "lean") return score <= 2;
  if (budgetBand === "comfort") return score >= 2 && score <= 3;
  return score >= 3;
}

function budgetSummaryLabel(budgetBand: BudgetBand) {
  if (budgetBand === "lean") return "$ to $$";
  if (budgetBand === "luxury") return "$$$ to $$$$";
  return "$$";
}

function executionSummary(execution: GenerationMetadata) {
  return execution.live
    ? `Live ${execution.provider} call via ${execution.model}.`
    : `Deterministic fallback via ${execution.provider}. ${execution.fallbackReason ?? "No provider output was used."}`;
}

function hashSeed(input: string) {
  let value = 0;

  for (const char of input) {
    value = (value * 31 + char.charCodeAt(0)) % 100000;
  }

  return value;
}

function coordinateFromSeed(seed: string, min: number, range: number) {
  const hashed = hashSeed(seed);
  return Number((min + ((hashed % 10000) / 10000) * range).toFixed(4));
}

function fallbackPriceBands(budgetBand: BudgetBand) {
  if (budgetBand === "lean") return ["$$", "$", "$$$"];
  if (budgetBand === "luxury") return ["$$$$", "$$$", "$$"];
  return ["$$$", "$$", "$"];
}

function fallbackPlaceNames(context: SlotContext, preferences: SchedulePlanPreferences) {
  const area = context.areaLabel === "your route" ? "Local" : context.areaLabel;

  if (context.slot.kind === "meal-window") {
    return [
      `${area} Market Table`,
      `${area} Daily Cafe`,
      `${area} Corner Kitchen`,
    ];
  }

  const profile = INTEREST_PROFILES[primaryInterest(preferences)];
  const suffixes = profile.queries;

  return suffixes.map((suffix, index) => {
    const title = suffix.split(" ").map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ");
    return `${area} ${title} ${index + 1}`;
  });
}

function decorateReason(place: PlaceCandidate, context: SlotContext, preferences: SchedulePlanPreferences) {
  if (context.slot.kind === "meal-window") {
    return `${mealLabelForSlot(context.slot, context.timeZone)} pick near ${context.areaLabel} that stays aligned with a ${preferences.budgetBand} budget.`;
  }

  const profile = INTEREST_PROFILES[primaryInterest(preferences)];
  return `${profile.title} near ${context.areaLabel} that fits the ${context.slot.durationMinutes}-minute gap without forcing a reroute.`;
}

function buildFallbackCandidates(context: SlotContext, preferences: SchedulePlanPreferences) {
  const names = fallbackPlaceNames(context, preferences);
  const priceBands = fallbackPriceBands(preferences.budgetBand);
  const category = context.slot.kind === "meal-window"
    ? "restaurant"
    : INTEREST_PROFILES[primaryInterest(preferences)].category;

  return names.map((name, index) => {
    const seed = `${context.slot.id}-${name}`;
    const place: PlaceCandidate = {
      placeId: undefined,
      name,
      source: "fallback",
      category,
      rating: Number((4.7 - index * 0.2).toFixed(1)),
      priceBand: priceBands[index % priceBands.length] ?? "$$",
      reviewSnippets: [
        `${context.areaLabel} option that stays easy to reach.`,
        context.slot.kind === "meal-window"
          ? "Reliable for a short meal window."
          : "Low-friction stop that still feels intentional.",
      ],
      reviewSummary: undefined,
      address: `${context.areaLabel}, ${context.previousEvent?.location ?? context.nextEvent?.location ?? "city center"}`,
      lat: coordinateFromSeed(seed, -60, 120),
      lng: coordinateFromSeed(`${seed}-lng`, -150, 300),
      googleMapsUri: undefined,
      reasonToRecommend: "",
    };

    return {
      ...place,
      reasonToRecommend: decorateReason(place, context, preferences),
    } satisfies PlaceCandidate;
  });
}

function contextForSlot(
  slot: ScheduleSlot,
  importedSchedule: ImportedCalendar,
  timelineById: Map<string, NormalizedCalendarEvent>,
): SlotContext {
  const timeZone = planningTimeZone(importedSchedule);
  const previousEvent = slot.previousEventId ? timelineById.get(slot.previousEventId) ?? null : null;
  const nextEvent = slot.nextEventId ? timelineById.get(slot.nextEventId) ?? null : null;
  const areaLabel = slot.city ?? importedSchedule.cityInference.city ?? "your route";
  const betweenCopy = previousEvent && nextEvent
    ? `between ${previousEvent.title} and ${nextEvent.title}`
    : previousEvent
      ? `after ${previousEvent.title}`
      : nextEvent
        ? `before ${nextEvent.title}`
        : "inside the current plan";

  return {
    slot,
    previousEvent,
    nextEvent,
    timeZone,
    areaLabel,
    betweenCopy,
    gapLabel: slot.kind === "meal-window" ? mealLabelForSlot(slot, timeZone) : "Quick stop",
  };
}

async function resolveSlotCandidates(
  importedSchedule: ImportedCalendar,
  preferences: SchedulePlanPreferences,
  slots: readonly ScheduleSlot[],
) {
  const timeline = sortEvents(importedSchedule.events);
  const timelineById = new Map(timeline.map((event) => [event.id, event]));

  return Promise.all(slots.map(async (slot) => {
    const context = contextForSlot(slot, importedSchedule, timelineById);
    const lookup = await fetchSlotPlaceCandidates({
      slotKind: slot.kind,
      city: context.areaLabel,
      interests: preferences.interests,
      budgetBand: preferences.budgetBand,
      durationMinutes: slot.durationMinutes,
      previousEventTitle: context.previousEvent?.title ?? null,
      nextEventTitle: context.nextEvent?.title ?? null,
    });
    const fallbackCandidates = buildFallbackCandidates(context, preferences);
    const usedFallbackCandidates = lookup.candidates.length === 0;
    const resolvedCandidates = (usedFallbackCandidates ? fallbackCandidates : lookup.candidates)
      .map((candidate) => ({
        ...candidate,
        reasonToRecommend: candidate.reasonToRecommend || decorateReason(candidate, context, preferences),
      }))
      .slice(0, 4);

    return {
      context,
      candidates: resolvedCandidates,
      placesLive: lookup.live,
      placesReason: lookup.reason,
      usedFallbackCandidates,
    } satisfies SlotCandidateResolution;
  }));
}

function preferredCandidate(resolution: SlotCandidateResolution, budgetBand: BudgetBand) {
  const fit = resolution.candidates.find((candidate) => isBudgetFit(candidate, budgetBand));
  return fit ?? resolution.candidates[0];
}

function fallbackDiningSelections(
  resolutions: readonly SlotCandidateResolution[],
  preferences: SchedulePlanPreferences,
) {
  const mealResolutions = resolutions.filter((resolution) => resolution.context.slot.kind === "meal-window");

  return {
    strategy: `Keep meals near the route, prioritizing ${preferences.budgetBand} budget fit and short service cycles.`,
    selections: mealResolutions.map((resolution) => {
      const chosen = preferredCandidate(resolution, preferences.budgetBand);
      return {
        slotId: resolution.context.slot.id,
        selectedName: chosen.name,
        rationale: `${chosen.name} best matches ${resolution.context.gapLabel.toLowerCase()} near ${resolution.context.areaLabel}.`,
      };
    }),
  };
}

function findPlaceByName(resolution: { candidates: PlaceCandidate[] }, name: string) {
  return resolution.candidates.find((candidate) => candidate.name.toLowerCase() === name.toLowerCase()) ?? null;
}

function fallbackItinerary(
  resolutions: readonly SlotCandidateResolution[],
  preferences: SchedulePlanPreferences,
  diningSelections: ReadonlyArray<z.infer<typeof diningAgentOutputSchema>["selections"][number]>,
) {
  const diningBySlot = new Map(diningSelections.map((selection) => [selection.slotId, selection.selectedName]));

  return {
    rhythm: `${preferences.pace} pacing that keeps the calendar intact and only uses windows that feel worth taking.`,
    suggestions: resolutions.map((resolution) => {
      const selectedName = diningBySlot.get(resolution.context.slot.id) ?? preferredCandidate(resolution, preferences.budgetBand).name;
      const selectedPlace = findPlaceByName(resolution, selectedName) ?? resolution.candidates[0];
      const window = suggestionWindow(resolution.context.slot, resolution.context.slot.kind === "meal-window" ? 60 : 35);

      return {
        slotId: resolution.context.slot.id,
        selectedName: selectedPlace.name,
        title: resolution.context.slot.kind === "meal-window"
          ? `${selectedPlace.name} for ${resolution.context.gapLabel.toLowerCase()}`
          : `${selectedPlace.name} during the open gap`,
        subtitle: `${resolution.context.gapLabel} · ${resolution.context.slot.durationMinutes} min available`,
        message: resolution.context.slot.kind === "meal-window"
          ? `This meal slot works ${resolution.context.betweenCopy} and keeps the plan grounded around a reliable table in ${resolution.context.areaLabel}.`
          : `This stop fits ${resolution.context.betweenCopy} without breaking the route, giving the day one intentional detour in ${resolution.context.areaLabel}.`,
        transitNote: transportNote(preferences, resolution.context.slot),
        estimatedDurationMinutes: window.durationMinutes,
      };
    }),
  };
}

export function adjustSelectionsForBudget(input: {
  preferences: SchedulePlanPreferences;
  resolutions: ReadonlyArray<{
    context: { slot: ScheduleSlot };
    candidates: PlaceCandidate[];
  }>;
  itinerary: ReadonlyArray<{
    slotId: string;
    selectedName: string;
  }>;
}) {
  const adjustments: z.infer<typeof budgetAgentOutputSchema>["adjustments"] = [];

  for (const suggestion of input.itinerary) {
    const resolution = input.resolutions.find((entry) => entry.context.slot.id === suggestion.slotId);

    if (!resolution) {
      adjustments.push({
        slotId: suggestion.slotId,
        approvedName: suggestion.selectedName,
        rationale: "No alternate candidates were available, so the original suggestion was kept.",
      });
      continue;
    }

    const selected = findPlaceByName(resolution, suggestion.selectedName) ?? resolution.candidates[0];
    const cheaperFit = resolution.candidates.find((candidate) => isBudgetFit(candidate, input.preferences.budgetBand));

    if (selected && isBudgetFit(selected, input.preferences.budgetBand)) {
      adjustments.push({
        slotId: suggestion.slotId,
        approvedName: selected.name,
        rationale: `${selected.name} already fits the ${input.preferences.budgetBand} budget band.`,
      });
      continue;
    }

    adjustments.push({
      slotId: suggestion.slotId,
      approvedName: cheaperFit?.name ?? selected?.name ?? resolution.candidates[0]?.name ?? suggestion.selectedName,
      rationale: cheaperFit
        ? `Swapped to ${cheaperFit.name} to stay closer to the ${input.preferences.budgetBand} budget band.`
        : `No better budget fit was available, so the strongest option stayed in place.`,
    });
  }

  const fitsBudget = adjustments.every((adjustment) => {
    const resolution = input.resolutions.find((entry) => entry.context.slot.id === adjustment.slotId);
    const approved = resolution ? findPlaceByName(resolution, adjustment.approvedName) : null;
    return approved ? isBudgetFit(approved, input.preferences.budgetBand) : true;
  });

  return {
    fitsBudget,
    summary: fitsBudget
      ? `The selected mix stays within the ${input.preferences.budgetBand} band while preserving one higher-conviction stop where it helps.`
      : `A few windows run hot for the ${input.preferences.budgetBand} band, but the route still uses the lowest-friction options available.`,
    adjustments,
  };
}

function workflowStepResult(
  step: ScheduleWorkflowStep,
  summary: string,
  execution: GenerationMetadata,
): ScheduleWorkflowStepResult {
  return {
    step,
    status: "completed",
    summary,
    execution,
  };
}

function aggregateGeneration(
  provider: SchedulePlanPreferences["provider"],
  steps: readonly ScheduleWorkflowStepResult[],
) {
  const liveStep = steps.find((step) => step.execution.live);
  const fallback = steps.at(-1)?.execution;

  if (liveStep) {
    return {
      ...liveStep.execution,
      fallbackReason: null,
    };
  }

  return fallback ?? {
    provider,
    model: "deterministic-schedule-planner",
    live: false,
    fallbackReason: "No workflow steps ran.",
  };
}

function buildWorkflow(startedAt: string, steps: readonly ScheduleWorkflowStepResult[]): SchedulePlanWorkflow {
  return {
    status: "completed",
    startedAt,
    completedAt: new Date().toISOString(),
    steps: [...steps],
  };
}

function buildFinalSuggestions(
  preferences: SchedulePlanPreferences,
  resolutions: readonly SlotCandidateResolution[],
  itinerary: z.infer<typeof itineraryAgentOutputSchema>,
  budget: z.infer<typeof budgetAgentOutputSchema>,
) {
  const budgetBySlot = new Map(budget.adjustments.map((adjustment) => [adjustment.slotId, adjustment]));

  return itinerary.suggestions.map((draft) => {
    const resolution = resolutions.find((entry) => entry.context.slot.id === draft.slotId);

    if (!resolution) {
      throw new Error(`Missing slot resolution for draft ${draft.slotId}.`);
    }

    const adjustment = budgetBySlot.get(draft.slotId);
    const chosenName = adjustment?.approvedName ?? draft.selectedName;
    const place = findPlaceByName(resolution, chosenName) ?? resolution.candidates[0];
    const window = suggestionWindow(
      resolution.context.slot,
      draft.estimatedDurationMinutes || (resolution.context.slot.kind === "meal-window" ? 60 : 35),
    );

    return {
      id: crypto.randomUUID(),
      slotId: draft.slotId,
      status: "pending",
      title: draft.title.replace(draft.selectedName, place.name),
      subtitle: draft.subtitle,
      message: draft.message,
      category: resolution.context.slot.kind === "meal-window" ? "meal" : place.category,
      place,
      agentReason: `${place.reasonToRecommend} ${resolution.usedFallbackCandidates ? "Built from deterministic fallback candidates." : "Backed by live Google Places results."}`,
      budgetReason: adjustment?.rationale ?? `${place.name} fits the ${preferences.budgetBand} budget band.`,
      estimatedCost: place.priceBand || budgetSummaryLabel(preferences.budgetBand),
      estimatedDurationMinutes: window.durationMinutes,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      transitNote: draft.transitNote,
      actionLabel: "Add to timeline",
      addedEventId: null,
    } satisfies ScheduleSuggestion;
  });
}

async function buildSchedulePlan(request: SchedulePlanRequest): Promise<SchedulePlan> {
  const startedAt = new Date().toISOString();
  const tripContext = deriveTripContext(request.importedSchedule);
  const slots = detectScheduleSlots(request.importedSchedule, request.preferences);
  const resolutions = await resolveSlotCandidates(request.importedSchedule, request.preferences, slots);
  const provider = request.preferences.provider;

  const dining = await runPlanningStep({
    provider,
    step: "dining",
    schemaName: "schedule_dining_agent_output",
    schema: diningAgentOutputSchema,
    systemPrompt: "You are the dining agent for a schedule-based trip planner. For each meal window, pick exactly one place from the candidate list that best balances route fit, budget, and quality. Use only exact candidate names.",
    userPrompt: JSON.stringify({
      budgetBand: request.preferences.budgetBand,
      pace: request.preferences.pace,
      interests: request.preferences.interests,
      mealSlots: resolutions
        .filter((resolution) => resolution.context.slot.kind === "meal-window")
        .map((resolution) => ({
          slotId: resolution.context.slot.id,
          gapLabel: resolution.context.gapLabel,
          areaLabel: resolution.context.areaLabel,
          between: resolution.context.betweenCopy,
          durationMinutes: resolution.context.slot.durationMinutes,
          candidates: resolution.candidates.map((candidate) => ({
            name: candidate.name,
            category: candidate.category,
            priceBand: candidate.priceBand,
            rating: candidate.rating,
            reasonToRecommend: candidate.reasonToRecommend,
          })),
        })),
    }, null, 2),
    fallbackFactory: () => fallbackDiningSelections(resolutions, request.preferences),
  });

  const itinerary = await runPlanningStep({
    provider,
    step: "itinerary",
    schemaName: "schedule_itinerary_agent_output",
    schema: itineraryAgentOutputSchema,
    systemPrompt: "You are the itinerary agent for a schedule-based trip planner. Build one concrete suggestion for each open slot using the provided candidates. Keep timing realistic, preserve the locked calendar structure, and use only exact candidate names.",
    userPrompt: JSON.stringify({
      budgetBand: request.preferences.budgetBand,
      pace: request.preferences.pace,
      transport: request.preferences.transport,
      comments: request.preferences.comments,
      diningSelections: dining.output.selections,
      slots: resolutions.map((resolution) => ({
        slotId: resolution.context.slot.id,
        slotKind: resolution.context.slot.kind,
        gapLabel: resolution.context.gapLabel,
        areaLabel: resolution.context.areaLabel,
        between: resolution.context.betweenCopy,
        durationMinutes: resolution.context.slot.durationMinutes,
        candidates: resolution.candidates.map((candidate) => ({
          name: candidate.name,
          category: candidate.category,
          priceBand: candidate.priceBand,
          rating: candidate.rating,
          reasonToRecommend: candidate.reasonToRecommend,
        })),
      })),
    }, null, 2),
    fallbackFactory: () => fallbackItinerary(resolutions, request.preferences, dining.output.selections),
  });

  const budget = await runPlanningStep({
    provider,
    step: "budget",
    schemaName: "schedule_budget_agent_output",
    schema: budgetAgentOutputSchema,
    systemPrompt: "You are the budget agent for a schedule-based trip planner. Review the draft suggestions against the stated budget band. If a cheaper candidate from the same slot is a better fit, approve that name instead. Use only exact candidate names.",
    userPrompt: JSON.stringify({
      budgetBand: request.preferences.budgetBand,
      itinerary: itinerary.output.suggestions.map((suggestion) => ({
        slotId: suggestion.slotId,
        selectedName: suggestion.selectedName,
      })),
      slotCandidates: resolutions.map((resolution) => ({
        slotId: resolution.context.slot.id,
        candidates: resolution.candidates.map((candidate) => ({
          name: candidate.name,
          priceBand: candidate.priceBand,
          rating: candidate.rating,
        })),
      })),
    }, null, 2),
    fallbackFactory: () => adjustSelectionsForBudget({
      preferences: request.preferences,
      resolutions,
      itinerary: itinerary.output.suggestions,
    }),
  });

  const workflowSteps = [
    workflowStepResult(
      "dining",
      `Selected ${dining.output.selections.length} meal recommendations. ${executionSummary(dining.execution)}`,
      dining.execution,
    ),
    workflowStepResult(
      "itinerary",
      `Built ${itinerary.output.suggestions.length} place-backed suggestions. ${executionSummary(itinerary.execution)}`,
      itinerary.execution,
    ),
    workflowStepResult(
      "budget",
      `${budget.output.summary} ${executionSummary(budget.execution)}`,
      budget.execution,
    ),
  ] satisfies ScheduleWorkflowStepResult[];

  return schedulePlanSchema.parse({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    request,
    tripContext,
    generation: aggregateGeneration(provider, workflowSteps),
    workflow: buildWorkflow(startedAt, workflowSteps),
    slots,
    suggestions: buildFinalSuggestions(request.preferences, resolutions, itinerary.output, budget.output),
    timeline: sortEvents(request.importedSchedule.events),
  });
}

export async function createSchedulePlan(request: SchedulePlanRequest) {
  const parsed = schedulePlanRequestSchema.parse(request);
  const stored = await buildSchedulePlan(parsed);
  return await saveSchedulePlan(stored);
}

export async function getSchedulePlanById(planId: string) {
  return await getStoredSchedulePlan(planId);
}

export async function addSuggestionToSchedulePlan(planId: string, suggestionId: string) {
  const existing = await getStoredSchedulePlan(planId);

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

  const slot = existing.slots.find((entry) => entry.id === suggestion.slotId);
  const addedEvent: NormalizedCalendarEvent = {
    id: crypto.randomUUID(),
    source: existing.request.importedSchedule.source,
    title: suggestion.place.name,
    description: `${suggestion.message} ${suggestion.agentReason} ${suggestion.budgetReason}`.trim(),
    location: suggestion.place.address ?? suggestion.place.name,
    startsAt: suggestion.startsAt,
    endsAt: suggestion.endsAt,
    isAllDay: false,
    timezone: existing.tripContext.timezone,
    type: slot?.kind === "meal-window" ? "meal" : "other",
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

  return await saveSchedulePlan(updated);
}

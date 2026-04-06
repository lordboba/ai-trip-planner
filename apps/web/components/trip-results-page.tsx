"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import type { SchedulePlan } from "@/lib/types";
import type { ClientSchedulePlan } from "@/lib/sanitize-plan-response";
import { formatScheduleDateRange, formatScheduleDayKeyLabel } from "@/lib/schedule-format";
import { getTimeZoneDayKey, resolveTimeZone } from "@/lib/timezone";
import { getDayColor } from "@/lib/day-colors";
import { tripPlannerApiClient } from "@/lib/api-client";
import { DayTab, type DayTimelineItem } from "./day-tab";
import { OverviewTab } from "./overview-tab";
import { TripMap, type MapPin } from "./trip-map";

type Props = {
  initialPlan: ClientSchedulePlan;
  googleMapsApiKey: string;
  googleMapsMapId: string;
};

function buildDayGroups(plan: SchedulePlan, timeZone: string) {
  const addedEventIds = new Set(
    plan.suggestions
      .filter((suggestion) => suggestion.status === "added" && suggestion.addedEventId)
      .map((suggestion) => suggestion.addedEventId as string),
  );
  const items: DayTimelineItem[] = [];

  for (const event of plan.timeline) {
    if (!event.locked && addedEventIds.has(event.id)) {
      continue;
    }

    items.push({
      kind: "event",
      id: event.id,
      startsAt: event.startsAt,
      event,
    });
  }

  for (const suggestion of plan.suggestions) {
    items.push({
      kind: suggestion.status === "pending" ? "pending-suggestion" : "added-suggestion",
      id: suggestion.id,
      startsAt: suggestion.startsAt,
      suggestion,
    });
  }

  items.sort((left, right) => left.startsAt.localeCompare(right.startsAt));

  const groupMap = new Map<string, DayTimelineItem[]>();

  for (const item of items) {
    const dayKey = getTimeZoneDayKey(item.startsAt, timeZone);
    const group = groupMap.get(dayKey) ?? [];
    group.push(item);
    groupMap.set(dayKey, group);
  }

  return [...groupMap.entries()].map(([dayKey, dayItems], dayIndex) => ({
    dayKey,
    dayIndex,
    items: dayItems,
  }));
}

function buildPinsForDay(items: DayTimelineItem[], dayIndex: number): MapPin[] {
  const dayColor = getDayColor(dayIndex);
  let pinNumber = 1;

  return items.flatMap((item) => {
    if (item.kind === "event") {
      return [];
    }

    const { lat, lng, name } = item.suggestion.place;

    if (typeof lat !== "number" || typeof lng !== "number") {
      return [];
    }

    return [{
      id: item.suggestion.id,
      lat,
      lng,
      label: name.length > 16 ? `${name.slice(0, 14)}…` : name,
      number: pinNumber++,
      isSuggestion: item.kind === "pending-suggestion",
      dayColor,
    }];
  });
}

function buildRoutesForDay(pins: MapPin[], dayIndex: number) {
  if (pins.length < 2) {
    return [];
  }

  return [{
    dayColor: getDayColor(dayIndex),
    waypoints: pins.map((pin) => ({ lat: pin.lat, lng: pin.lng })),
  }];
}

export function TripResultsPage({ initialPlan, googleMapsApiKey, googleMapsMapId }: Props) {
  const [plan, setPlan] = useState(initialPlan);
  const [activeTab, setActiveTab] = useState(-1);
  const [pendingSuggestionId, setPendingSuggestionId] = useState<string | null>(null);
  const [calendarAddedIds, setCalendarAddedIds] = useState(() => new Set<string>());
  const [highlightedPinId, setHighlightedPinId] = useState<string | null>(null);
  const [hoveredDayIndex, setHoveredDayIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const scheduleTimeZone = resolveTimeZone(
    plan.tripContext.timezone ?? plan.request.importedSchedule.timezone,
  );
  const dayGroups = useMemo(() => buildDayGroups(plan as SchedulePlan, scheduleTimeZone), [plan, scheduleTimeZone]);
  const dateRange = formatScheduleDateRange(plan.tripContext.tripStart, plan.tripContext.tripEnd, scheduleTimeZone);
  const city = plan.tripContext.cityInference.city ?? "Imported trip";
  const pendingSuggestions = plan.suggestions.filter((suggestion) => suggestion.status === "pending");
  const addedSuggestions = plan.suggestions.filter((suggestion) => suggestion.status === "added");

  const overviewDayIndex = activeTab === -1 ? hoveredDayIndex : null;
  const overviewGroup = overviewDayIndex !== null ? dayGroups[overviewDayIndex] : null;

  const mapPins = useMemo(() => {
    if (activeTab === -1) {
      if (overviewGroup) {
        return buildPinsForDay(overviewGroup.items, overviewGroup.dayIndex);
      }

      return dayGroups.flatMap((group) => buildPinsForDay(group.items, group.dayIndex));
    }

    const group = dayGroups[activeTab];
    return group ? buildPinsForDay(group.items, group.dayIndex) : [];
  }, [activeTab, dayGroups, overviewGroup]);

  const mapRoutes = useMemo(() => {
    if (activeTab === -1) {
      if (overviewGroup) {
        const pins = buildPinsForDay(overviewGroup.items, overviewGroup.dayIndex);
        return buildRoutesForDay(pins, overviewGroup.dayIndex);
      }

      return dayGroups.flatMap((group) => {
        const pins = buildPinsForDay(group.items, group.dayIndex);
        return buildRoutesForDay(pins, group.dayIndex);
      });
    }

    const group = dayGroups[activeTab];

    if (!group) {
      return [];
    }

    const pins = buildPinsForDay(group.items, group.dayIndex);
    return buildRoutesForDay(pins, group.dayIndex);
  }, [activeTab, dayGroups, overviewGroup]);

  const legendItems = useMemo(() => {
    if (activeTab !== -1 || overviewGroup) {
      return [];
    }

    return dayGroups.map((group) => ({
      color: getDayColor(group.dayIndex).hex,
      label: `Day ${group.dayIndex + 1}`,
    }));
  }, [activeTab, dayGroups, overviewGroup]);

  function addSuggestion(suggestionId: string) {
    setError(null);
    setPendingSuggestionId(suggestionId);

    startTransition(async () => {
      try {
        const data = await tripPlannerApiClient.addSuggestionToSchedulePlan(plan.id, suggestionId) as
          ClientSchedulePlan & { calendarEventCreated?: boolean };
        const { calendarEventCreated, ...updatedPlan } = data;

        setPlan(updatedPlan);

        if (calendarEventCreated) {
          setCalendarAddedIds((current) => new Set([...current, suggestionId]));
        }
      } catch (addError) {
        setError(addError instanceof Error ? addError.message : "Unable to add suggestion.");
      } finally {
        setPendingSuggestionId(null);
      }
    });
  }

  return (
    <main className="flex min-h-screen flex-col bg-cream">
      <div className="border-b border-warm-100 bg-white/80 px-4 py-3 backdrop-blur md:px-5">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
          <Link href="/plan" className="text-sm text-warm-400 transition-colors hover:text-warm-900">
            ← Back to planner
          </Link>
          <div className="text-center">
            <div className="text-lg font-bold text-warm-900">{city}</div>
            <div className="text-xs text-warm-400">
              {dateRange} · {plan.tripContext.travelDayCount} days
            </div>
          </div>
          <div className="hidden text-xs text-warm-400 md:block">
            {pendingSuggestions.length} pending · {addedSuggestions.length} added
          </div>
        </div>
      </div>

      <div className="border-b border-warm-100 bg-white px-4 py-2.5 md:px-5">
        <div className="mx-auto flex max-w-[1600px] items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setActiveTab(-1);
              setHoveredDayIndex(null);
            }}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === -1
                ? "bg-gradient-to-r from-coral to-coral-deep text-white"
                : "bg-warm-50 text-warm-600 hover:bg-warm-100"
            }`}
          >
            Overview
          </button>
          {dayGroups.map((group) => (
            <button
              key={group.dayKey}
              type="button"
              onClick={() => {
                setActiveTab(group.dayIndex);
                setHighlightedPinId(null);
              }}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === group.dayIndex
                  ? "bg-gradient-to-r from-coral to-coral-deep text-white"
                  : "bg-warm-50 text-warm-600 hover:bg-warm-100"
              }`}
            >
              Day {group.dayIndex + 1} · {formatScheduleDayKeyLabel(group.dayKey)}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mx-auto mt-3 w-full max-w-[1600px] px-4 md:px-5">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>
        </div>
      )}

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col overflow-hidden px-4 py-4 md:px-5 lg:flex-row">
        <div className="overflow-y-auto rounded-[1.6rem] border border-warm-100 bg-white shadow-[0_24px_70px_rgba(26,22,20,0.08)] lg:h-[calc(100vh-9.5rem)] lg:w-[38%]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.16 }}
            >
              {activeTab === -1 ? (
                <OverviewTab
                  plan={plan as SchedulePlan}
                  dayGroups={dayGroups}
                  onSelectDay={setActiveTab}
                  onHoverDay={setHoveredDayIndex}
                />
              ) : (
                <DayTab
                  items={dayGroups[activeTab]?.items ?? []}
                  timeZone={scheduleTimeZone}
                  pendingSuggestionId={pendingSuggestionId}
                  calendarAddedIds={calendarAddedIds}
                  onAddSuggestion={addSuggestion}
                  onItemHover={setHighlightedPinId}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-4 overflow-hidden rounded-[1.6rem] border border-warm-100 bg-white shadow-[0_24px_70px_rgba(26,22,20,0.08)] lg:mt-0 lg:ml-4 lg:h-[calc(100vh-9.5rem)] lg:flex-1">
          <TripMap
            apiKey={googleMapsApiKey}
            mapId={googleMapsMapId}
            pins={mapPins}
            routes={mapRoutes}
            highlightedPinId={highlightedPinId}
            onPinClick={setHighlightedPinId}
            onPinHover={setHighlightedPinId}
            showLegend={activeTab === -1}
            legendItems={legendItems}
          />
        </div>
      </div>
    </main>
  );
}

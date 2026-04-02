# Trip Results Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current flat timeline results page with a tabbed day-by-day split view (itinerary + interactive Google Maps with routes), add Google Calendar write-back on suggestion add, and strip unused generation metadata.

**Architecture:** Tabbed layout — Overview tab + per-day tabs. Each day tab has a left itinerary panel (~38%) with locked events and collapsible suggestion cards, and a right map panel (~62%) with numbered pins and route polylines via Google Maps JS SDK. Overview tab shows trip summary + day previews + all-days color-coded map. "Add to trip" creates a Google Calendar event in parallel.

**Tech Stack:** Next.js 16, React 19, `@vis.gl/react-google-maps`, Google Directions API, Framer Motion, Tailwind CSS 4, Zod, Google Calendar API v3

---

### Task 1: Install Google Maps React library

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
pnpm add @vis.gl/react-google-maps
```

- [ ] **Step 2: Verify installation**

```bash
pnpm ls @vis.gl/react-google-maps
```

Expected: shows the installed version.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add @vis.gl/react-google-maps for Maps JS SDK"
```

---

### Task 2: Create day color utility

**Files:**
- Create: `lib/day-colors.ts`

This utility assigns a consistent color to each day index, used for map routes, pins, and day card borders.

- [ ] **Step 1: Create the utility**

```typescript
// lib/day-colors.ts

const DAY_COLORS = [
  { name: "coral", hex: "#FF6B42", tailwind: "border-coral" },
  { name: "blue", hex: "#4a90d9", tailwind: "border-[#4a90d9]" },
  { name: "green", hex: "#6bc96b", tailwind: "border-[#6bc96b]" },
  { name: "purple", hex: "#9b6bd4", tailwind: "border-[#9b6bd4]" },
  { name: "amber", hex: "#d4a26b", tailwind: "border-[#d4a26b]" },
] as const;

export type DayColor = (typeof DAY_COLORS)[number];

export function getDayColor(dayIndex: number): DayColor {
  return DAY_COLORS[dayIndex % DAY_COLORS.length];
}

export { DAY_COLORS };
```

- [ ] **Step 2: Commit**

```bash
git add lib/day-colors.ts
git commit -m "feat: add day color utility for map routes and tab borders"
```

---

### Task 3: Create the `TripMap` component

**Files:**
- Create: `components/trip-map.tsx`

This is the Google Maps JS SDK wrapper. It renders an `APIProvider` + `Map` with numbered `AdvancedMarkerElement` pins and route polylines.

- [ ] **Step 1: Create the map component**

Create `components/trip-map.tsx`:

```typescript
"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { APIProvider, Map, useMap, AdvancedMarker, Pin } from "@vis.gl/react-google-maps";
import type { DayColor } from "@/lib/day-colors";

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  number: number;
  isSuggestion: boolean;
  dayColor: DayColor;
};

type TripMapProps = {
  apiKey: string;
  mapId: string;
  pins: MapPin[];
  routes: { dayColor: DayColor; waypoints: { lat: number; lng: number }[] }[];
  highlightedPinId: string | null;
  onPinClick: (pinId: string) => void;
  onPinHover: (pinId: string | null) => void;
  showLegend?: boolean;
  legendItems?: { color: string; label: string }[];
};

function RouteRenderer({
  routes,
}: {
  routes: TripMapProps["routes"];
}) {
  const map = useMap();
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    if (!map || routes.length === 0) return;

    // Clear previous polylines
    for (const polyline of polylinesRef.current) {
      polyline.setMap(null);
    }
    polylinesRef.current = [];

    const directionsService = new google.maps.DirectionsService();

    for (const route of routes) {
      if (route.waypoints.length < 2) continue;

      const origin = route.waypoints[0];
      const destination = route.waypoints[route.waypoints.length - 1];
      const intermediateWaypoints = route.waypoints.slice(1, -1).map((wp) => ({
        location: new google.maps.LatLng(wp.lat, wp.lng),
        stopover: true,
      }));

      directionsService.route(
        {
          origin: new google.maps.LatLng(origin.lat, origin.lng),
          destination: new google.maps.LatLng(destination.lat, destination.lng),
          waypoints: intermediateWaypoints,
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === google.maps.DirectionsStatus.OK && result) {
            const polyline = new google.maps.Polyline({
              path: result.routes[0].overview_path,
              strokeColor: route.dayColor.hex,
              strokeOpacity: 0.7,
              strokeWeight: 4,
              map,
            });
            polylinesRef.current.push(polyline);
          }
        },
      );
    }

    return () => {
      for (const polyline of polylinesRef.current) {
        polyline.setMap(null);
      }
      polylinesRef.current = [];
    };
  }, [map, routes]);

  return null;
}

function FitBounds({ pins }: { pins: MapPin[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || pins.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    for (const pin of pins) {
      bounds.extend({ lat: pin.lat, lng: pin.lng });
    }
    map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
  }, [map, pins]);

  return null;
}

export function TripMap({
  apiKey,
  mapId,
  pins,
  routes,
  highlightedPinId,
  onPinClick,
  onPinHover,
  showLegend = false,
  legendItems = [],
}: TripMapProps) {
  const defaultCenter = pins.length > 0
    ? { lat: pins[0].lat, lng: pins[0].lng }
    : { lat: 35.6762, lng: 139.6503 };

  return (
    <APIProvider apiKey={apiKey}>
      <div className="relative h-full w-full">
        <Map
          defaultCenter={defaultCenter}
          defaultZoom={12}
          mapId={mapId}
          gestureHandling="cooperative"
          disableDefaultUI={false}
          zoomControl={true}
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
        >
          <FitBounds pins={pins} />
          <RouteRenderer routes={routes} />

          {pins.map((pin) => {
            const isHighlighted = highlightedPinId === pin.id;
            const isDimmed = highlightedPinId !== null && !isHighlighted;

            return (
              <AdvancedMarker
                key={pin.id}
                position={{ lat: pin.lat, lng: pin.lng }}
                onClick={() => onPinClick(pin.id)}
                onMouseEnter={() => onPinHover(pin.id)}
                onMouseLeave={() => onPinHover(null)}
              >
                <div
                  className="flex flex-col items-center transition-opacity duration-200"
                  style={{ opacity: isDimmed ? 0.35 : 1 }}
                >
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white shadow-md"
                    style={{
                      backgroundColor: pin.isSuggestion ? pin.dayColor.hex : "#3d3530",
                      border: pin.isSuggestion ? "2px dashed white" : "none",
                      boxShadow: isHighlighted
                        ? `0 0 0 4px ${pin.dayColor.hex}40`
                        : "0 2px 4px rgba(0,0,0,0.3)",
                    }}
                  >
                    {pin.number}
                  </div>
                  <div className="mt-0.5 text-[9px] font-semibold text-warm-900">{pin.label}</div>
                </div>
              </AdvancedMarker>
            );
          })}
        </Map>

        {showLegend && legendItems.length > 0 && (
          <div className="absolute bottom-3 left-3 flex gap-3 rounded-lg bg-white/90 px-3 py-2 shadow-sm backdrop-blur">
            {legendItems.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[10px] text-warm-600">{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </APIProvider>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: no errors related to `trip-map.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/trip-map.tsx
git commit -m "feat: create TripMap component with Google Maps JS SDK, pins, and route rendering"
```

---

### Task 4: Create `SuggestionCard` component (accordion)

**Files:**
- Create: `components/suggestion-card.tsx`

Collapsed: icon, name, rating, category, time. Expanded: reasoning, stats, review, transit note, action buttons.

- [ ] **Step 1: Create the component**

Create `components/suggestion-card.tsx`:

```typescript
"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { ScheduleSuggestion } from "@/lib/types";
import { formatScheduleTimeRange } from "@/lib/schedule-format";

const CATEGORY_ICONS: Record<string, string> = {
  dining: "🍜",
  culture: "⛩",
  shopping: "🛍",
  nature: "🌳",
  nightlife: "🌙",
  entertainment: "🎭",
};

function getCategoryIcon(category: string): string {
  const lower = category.toLowerCase();
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return "📍";
}

type SuggestionCardProps = {
  suggestion: ScheduleSuggestion;
  timeZone: string;
  isExpanded: boolean;
  isPending: boolean;
  onToggle: () => void;
  onAdd: () => void;
  onHover: (hovered: boolean) => void;
};

export function SuggestionCard({
  suggestion,
  timeZone,
  isExpanded,
  isPending,
  onToggle,
  onAdd,
  onHover,
}: SuggestionCardProps) {
  const icon = getCategoryIcon(suggestion.category);

  return (
    <div
      className="cursor-pointer"
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <div
        onClick={onToggle}
        className={`rounded-xl border transition-all duration-200 ${
          isExpanded
            ? "border-coral bg-[linear-gradient(135deg,#fff8f5,#fff)] shadow-[0_4px_12px_rgba(255,107,66,0.1)]"
            : "border-dashed border-coral/35 bg-[linear-gradient(135deg,#fff8f5,#fff)]"
        }`}
      >
        {/* Collapsed header — always visible */}
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-coral-wash text-sm">
              {icon}
            </div>
            <div>
              <div className="text-[13px] font-semibold text-warm-900">{suggestion.place.name}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[11px] text-coral">★ {suggestion.place.rating.toFixed(1)}</span>
                <span className="text-[11px] text-warm-400">· {suggestion.category}</span>
                <span className="text-[11px] text-warm-400">
                  · {formatScheduleTimeRange(suggestion.startsAt, suggestion.endsAt, false, timeZone).split(" - ")[0]}
                </span>
              </div>
            </div>
          </div>
          <span
            className="text-lg text-warm-400/50 transition-transform duration-200"
            style={{ transform: isExpanded ? "rotate(-90deg)" : "rotate(90deg)" }}
          >
            ›
          </span>
        </div>

        {/* Expanded details */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="border-t border-coral/15 px-3 pb-3 pt-2.5">
                {/* Why this spot */}
                <div className="rounded-lg bg-warm-50 p-2.5 mb-2.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-warm-400 mb-1">
                    Why this spot
                  </div>
                  <div className="text-[13px] leading-relaxed text-warm-900">
                    {suggestion.message}
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex gap-4 mb-2.5">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-warm-400">Duration</div>
                    <div className="text-[13px] font-semibold text-warm-900">~{suggestion.estimatedDurationMinutes} min</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-warm-400">Time</div>
                    <div className="text-[13px] font-semibold text-warm-900">
                      {formatScheduleTimeRange(suggestion.startsAt, suggestion.endsAt, false, timeZone)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-warm-400">Cost</div>
                    <div className="text-[13px] font-semibold text-warm-900">{suggestion.estimatedCost}</div>
                  </div>
                </div>

                {/* Review snippet */}
                {suggestion.place.reviewSnippets.length > 0 && (
                  <p className="text-xs italic text-warm-400 leading-relaxed mb-2.5">
                    &ldquo;{suggestion.place.reviewSnippets[0]}&rdquo;
                  </p>
                )}

                {/* Transit note */}
                {suggestion.transitNote && (
                  <div className="flex items-center gap-1.5 text-[11px] text-warm-400 mb-3">
                    <span>🚃</span> {suggestion.transitNote}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={onAdd}
                    disabled={isPending}
                    className="flex-1 rounded-lg bg-gradient-to-r from-coral to-coral-deep px-4 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {isPending ? "Adding..." : "Add to trip"}
                  </button>
                  {suggestion.place.googleMapsUri && (
                    <a
                      href={suggestion.place.googleMapsUri}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg bg-warm-50 px-3.5 py-2.5 text-[13px] text-warm-400 transition-colors hover:bg-warm-100"
                    >
                      Maps ↗
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add components/suggestion-card.tsx
git commit -m "feat: create SuggestionCard component with accordion expand/collapse"
```

---

### Task 5: Create `LockedEventCard` component

**Files:**
- Create: `components/locked-event-card.tsx`

Compact card for imported calendar events.

- [ ] **Step 1: Create the component**

Create `components/locked-event-card.tsx`:

```typescript
"use client";

import type { NormalizedCalendarEvent } from "@/lib/types";
import { formatScheduleTimeRange, titleCaseEventType } from "@/lib/schedule-format";

type LockedEventCardProps = {
  event: NormalizedCalendarEvent;
  timeZone: string;
  onHover: (hovered: boolean) => void;
};

export function LockedEventCard({ event, timeZone, onHover }: LockedEventCardProps) {
  return (
    <div
      className="flex gap-2.5 items-start"
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <div className="mt-1 w-[3px] min-h-[50px] rounded-sm bg-warm-900" />
      <div className="flex-1">
        <div className="text-[11px] text-warm-400">
          {formatScheduleTimeRange(event.startsAt, event.endsAt, event.isAllDay, event.timezone ?? timeZone)}
        </div>
        <div className="text-sm font-semibold text-warm-900">{event.title}</div>
        {event.location && (
          <div className="text-[11px] text-warm-400">{event.location}</div>
        )}
        {!event.location && event.type !== "other" && (
          <div className="text-[11px] text-warm-400">{titleCaseEventType(event.type)}</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/locked-event-card.tsx
git commit -m "feat: create LockedEventCard component for calendar events"
```

---

### Task 6: Create `AddedSuggestionCard` component

**Files:**
- Create: `components/added-suggestion-card.tsx`

Shown after a suggestion is accepted — solid border, green checkmark, "Added to Google Calendar" note.

- [ ] **Step 1: Create the component**

Create `components/added-suggestion-card.tsx`:

```typescript
"use client";

import type { ScheduleSuggestion } from "@/lib/types";
import { formatScheduleTimeRange } from "@/lib/schedule-format";

type AddedSuggestionCardProps = {
  suggestion: ScheduleSuggestion;
  timeZone: string;
  calendarAdded: boolean;
  onHover: (hovered: boolean) => void;
};

export function AddedSuggestionCard({ suggestion, timeZone, calendarAdded, onHover }: AddedSuggestionCardProps) {
  return (
    <div
      className="flex gap-2.5 items-start"
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <div className="mt-1 w-[3px] min-h-[50px] rounded-sm bg-warm-900" />
      <div className="flex-1 rounded-xl border border-warm-100 bg-white p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-warm-900">{suggestion.place.name}</div>
            <div className="text-[11px] text-warm-400">
              {formatScheduleTimeRange(suggestion.startsAt, suggestion.endsAt, false, timeZone)}
              {" · "}{suggestion.category}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[#6bc96b]">
              <span className="text-[10px] font-bold text-white">✓</span>
            </div>
            <span className="text-[10px] font-semibold text-[#6bc96b]">Added</span>
          </div>
        </div>
        {calendarAdded && (
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-warm-400">
            <span>📅</span> Added to Google Calendar
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/added-suggestion-card.tsx
git commit -m "feat: create AddedSuggestionCard for accepted suggestions"
```

---

### Task 7: Create `DayTab` component

**Files:**
- Create: `components/day-tab.tsx`

Single day's itinerary timeline — renders locked events, pending suggestions (as SuggestionCards), and added suggestions.

- [ ] **Step 1: Create the component**

Create `components/day-tab.tsx`:

```typescript
"use client";

import { useState } from "react";
import type { NormalizedCalendarEvent, ScheduleSuggestion } from "@/lib/types";
import { LockedEventCard } from "./locked-event-card";
import { SuggestionCard } from "./suggestion-card";
import { AddedSuggestionCard } from "./added-suggestion-card";

export type DayTimelineItem =
  | { kind: "event"; id: string; startsAt: string; event: NormalizedCalendarEvent }
  | { kind: "pending-suggestion"; id: string; startsAt: string; suggestion: ScheduleSuggestion }
  | { kind: "added-suggestion"; id: string; startsAt: string; suggestion: ScheduleSuggestion };

type DayTabProps = {
  items: DayTimelineItem[];
  timeZone: string;
  pendingSuggestionId: string | null;
  calendarAddedIds: Set<string>;
  onAddSuggestion: (suggestionId: string) => void;
  onItemHover: (itemId: string | null) => void;
};

export function DayTab({
  items,
  timeZone,
  pendingSuggestionId,
  calendarAddedIds,
  onAddSuggestion,
  onItemHover,
}: DayTabProps) {
  const [expandedSuggestionId, setExpandedSuggestionId] = useState<string | null>(null);

  return (
    <div className="space-y-3 p-4 overflow-y-auto h-full">
      {items.map((item) => {
        if (item.kind === "event") {
          return (
            <LockedEventCard
              key={item.id}
              event={item.event}
              timeZone={timeZone}
              onHover={(hovered) => onItemHover(hovered ? item.id : null)}
            />
          );
        }

        if (item.kind === "added-suggestion") {
          return (
            <AddedSuggestionCard
              key={item.id}
              suggestion={item.suggestion}
              timeZone={timeZone}
              calendarAdded={calendarAddedIds.has(item.suggestion.id)}
              onHover={(hovered) => onItemHover(hovered ? item.id : null)}
            />
          );
        }

        return (
          <SuggestionCard
            key={item.id}
            suggestion={item.suggestion}
            timeZone={timeZone}
            isExpanded={expandedSuggestionId === item.suggestion.id}
            isPending={pendingSuggestionId === item.suggestion.id}
            onToggle={() =>
              setExpandedSuggestionId(
                expandedSuggestionId === item.suggestion.id ? null : item.suggestion.id,
              )
            }
            onAdd={() => onAddSuggestion(item.suggestion.id)}
            onHover={(hovered) => onItemHover(hovered ? item.id : null)}
          />
        );
      })}

      {items.length === 0 && (
        <div className="flex items-center justify-center py-12 text-sm text-warm-400">
          No events or suggestions for this day.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/day-tab.tsx
git commit -m "feat: create DayTab component for single-day itinerary timeline"
```

---

### Task 8: Create `OverviewTab` component

**Files:**
- Create: `components/overview-tab.tsx`

Trip summary card + day preview cards.

- [ ] **Step 1: Create the component**

Create `components/overview-tab.tsx`:

```typescript
"use client";

import type { SchedulePlan } from "@/lib/types";
import { formatScheduleDayKeyLabel } from "@/lib/schedule-format";
import { getDayColor } from "@/lib/day-colors";
import type { DayTimelineItem } from "./day-tab";

type OverviewTabProps = {
  plan: SchedulePlan;
  dayGroups: { dayKey: string; dayIndex: number; items: DayTimelineItem[] }[];
  onSelectDay: (dayIndex: number) => void;
  onHoverDay: (dayIndex: number | null) => void;
};

export function OverviewTab({ plan, dayGroups, onSelectDay, onHoverDay }: OverviewTabProps) {
  const pendingSuggestions = plan.suggestions.filter((s) => s.status === "pending");
  const totalEstimatedCost = plan.suggestions
    .filter((s) => s.status === "added")
    .reduce((sum, s) => {
      const parsed = parseFloat(s.estimatedCost.replace(/[^0-9.]/g, ""));
      return sum + (Number.isNaN(parsed) ? 0 : parsed);
    }, 0);

  return (
    <div className="space-y-4 p-4 overflow-y-auto h-full">
      {/* Trip Summary Card */}
      <div className="rounded-xl bg-gradient-to-br from-warm-900 to-warm-600 p-4 text-white">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-white/60 mb-3">
          Trip Summary
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xl font-bold">{plan.tripContext.travelDayCount}</div>
            <div className="text-[11px] text-white/60">Days</div>
          </div>
          <div>
            <div className="text-xl font-bold">{plan.timeline.length}</div>
            <div className="text-[11px] text-white/60">Events</div>
          </div>
          <div>
            <div className="text-xl font-bold">{pendingSuggestions.length}</div>
            <div className="text-[11px] text-white/60">Suggestions</div>
          </div>
          <div>
            <div className="text-xl font-bold">
              {totalEstimatedCost > 0 ? `~$${Math.round(totalEstimatedCost)}` : "—"}
            </div>
            <div className="text-[11px] text-white/60">Est. Budget</div>
          </div>
        </div>

        {/* Preference tags */}
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/15 pt-3">
          {plan.request.preferences.interests.map((interest) => (
            <span
              key={interest}
              className="rounded-full bg-white/15 px-2 py-0.5 text-[10px]"
            >
              {interest}
            </span>
          ))}
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px]">
            {plan.request.preferences.pace}
          </span>
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px]">
            {plan.request.preferences.transport}
          </span>
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px]">
            {plan.request.preferences.budgetBand}
          </span>
        </div>
      </div>

      {/* Day Preview Cards */}
      <div className="text-[10px] font-semibold uppercase tracking-wider text-warm-400">
        Day by Day
      </div>

      {dayGroups.map(({ dayKey, dayIndex, items }) => {
        const dayColor = getDayColor(dayIndex);

        return (
          <div
            key={dayKey}
            onClick={() => onSelectDay(dayIndex)}
            onMouseEnter={() => onHoverDay(dayIndex)}
            onMouseLeave={() => onHoverDay(null)}
            className="cursor-pointer rounded-lg border border-warm-100 bg-white p-3 transition-shadow hover:shadow-md"
            style={{ borderLeftWidth: "3px", borderLeftColor: dayColor.hex }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-[13px] font-bold text-warm-900">
                Day {dayIndex + 1} · {formatScheduleDayKeyLabel(dayKey)}
              </div>
              <span className="text-sm text-warm-400/50">→</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {items.map((item) => {
                const isSuggestion = item.kind === "pending-suggestion" || item.kind === "added-suggestion";
                const label = item.kind === "event"
                  ? item.event.title
                  : item.suggestion.place.name;

                return (
                  <span
                    key={item.id}
                    className={`rounded-md px-2 py-0.5 text-[10px] ${
                      isSuggestion
                        ? "border border-dashed border-coral/35 bg-coral-wash text-coral"
                        : "bg-warm-50 text-warm-600"
                    }`}
                  >
                    {label.length > 20 ? `${label.slice(0, 18)}…` : label}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/overview-tab.tsx
git commit -m "feat: create OverviewTab component with trip summary and day previews"
```

---

### Task 9: Create Google Calendar event creation utility

**Files:**
- Create: `lib/server/google-calendar-write.ts`
- Modify: `lib/server/google-calendar-auth.ts:66` (update OAuth scope)

- [ ] **Step 1: Update OAuth scope to include write access**

In `lib/server/google-calendar-auth.ts`, the current scope is `calendar.readonly`. Change it to also request write access:

Change line 69:
```
    scope: "https://www.googleapis.com/auth/calendar.readonly",
```
to:
```
    scope: "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events",
```

- [ ] **Step 2: Create the calendar write utility**

Create `lib/server/google-calendar-write.ts`:

```typescript
import { getGoogleAccessTokenFromCookies } from "./google-calendar-auth";

type CreateCalendarEventInput = {
  summary: string;
  description: string;
  location: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  timeZone: string;
};

export async function createGoogleCalendarEvent(
  input: CreateCalendarEventInput,
): Promise<{ success: boolean; eventId?: string }> {
  const accessToken = await getGoogleAccessTokenFromCookies();

  if (!accessToken) {
    return { success: false };
  }

  const body = {
    summary: input.summary,
    description: input.description,
    location: input.location,
    start: {
      dateTime: input.startTime,
      timeZone: input.timeZone,
    },
    end: {
      dateTime: input.endTime,
      timeZone: input.timeZone,
    },
  };

  try {
    const response = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      console.error(`Google Calendar event creation failed: ${response.status}`);
      return { success: false };
    }

    const data = (await response.json()) as { id?: string };
    return { success: true, eventId: data.id };
  } catch (error) {
    console.error("Google Calendar event creation error:", error);
    return { success: false };
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/server/google-calendar-write.ts lib/server/google-calendar-auth.ts
git commit -m "feat: add Google Calendar event creation and update OAuth scope for write access"
```

---

### Task 10: Create API endpoint for calendar event creation on suggestion add

**Files:**
- Modify: `app/api/schedule-plans/[planId]/suggestions/[suggestionId]/add/route.ts`

Extend the existing add endpoint to also create a Google Calendar event. The calendar creation is fire-and-forget — it doesn't block the response.

- [ ] **Step 1: Update the add endpoint**

Replace the contents of `app/api/schedule-plans/[planId]/suggestions/[suggestionId]/add/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { requireApiAccess } from "@/lib/server/access-gate-server";
import { addSuggestionToSchedulePlanRecord, fetchSchedulePlanRecord } from "@/lib/server/schedule-backend";
import { createGoogleCalendarEvent } from "@/lib/server/google-calendar-write";
import { resolveTimeZone } from "@/lib/timezone";

export const maxDuration = 300;

export async function POST(
  _: Request,
  { params }: { params: Promise<{ planId: string; suggestionId: string }> },
) {
  const unauthorized = await requireApiAccess();

  if (unauthorized) {
    return unauthorized;
  }

  const { planId, suggestionId } = await params;
  const updated = await addSuggestionToSchedulePlanRecord(planId, suggestionId);

  if (!updated) {
    return NextResponse.json(
      { error: "Schedule plan or suggestion was not found." },
      { status: 404 },
    );
  }

  // Find the suggestion that was just added to create a calendar event
  const addedSuggestion = updated.suggestions.find(
    (s) => s.id === suggestionId && s.status === "added",
  );

  let calendarEventCreated = false;

  if (addedSuggestion) {
    const timeZone = resolveTimeZone(
      updated.tripContext.timezone ?? updated.request.importedSchedule.timezone,
    );

    const description = [
      addedSuggestion.place.googleMapsUri,
      addedSuggestion.place.reviewSummary,
    ]
      .filter(Boolean)
      .join("\n\n");

    const result = await createGoogleCalendarEvent({
      summary: addedSuggestion.place.name,
      description,
      location: addedSuggestion.place.address ?? "",
      startTime: addedSuggestion.startsAt,
      endTime: addedSuggestion.endsAt,
      timeZone,
    });

    calendarEventCreated = result.success;
  }

  return NextResponse.json({ ...updated, calendarEventCreated });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/schedule-plans/[planId]/suggestions/[suggestionId]/add/route.ts
git commit -m "feat: create Google Calendar event when adding suggestion to trip"
```

---

### Task 11: Create the main `TripResultsPage` component

**Files:**
- Create: `components/trip-results-page.tsx`

This is the orchestrator — manages tabs, map state, hover sync, and the add-suggestion flow. Replaces `SchedulePlanResults`.

- [ ] **Step 1: Create the component**

Create `components/trip-results-page.tsx`:

```typescript
"use client";

import { useMemo, useState, useTransition, useCallback, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { SchedulePlan } from "@/lib/types";
import {
  formatScheduleDateRange,
  formatScheduleDayKeyLabel,
} from "@/lib/schedule-format";
import { getTimeZoneDayKey, resolveTimeZone } from "@/lib/timezone";
import { getDayColor, DAY_COLORS } from "@/lib/day-colors";
import { TripMap } from "./trip-map";
import type { MapPin } from "./trip-map";
import { DayTab } from "./day-tab";
import type { DayTimelineItem } from "./day-tab";
import { OverviewTab } from "./overview-tab";

type Props = {
  initialPlan: SchedulePlan;
  googleMapsApiKey: string;
  googleMapsMapId: string;
};

function buildDayGroups(plan: SchedulePlan, timeZone: string) {
  type RawItem = DayTimelineItem & { startsAt: string };
  const items: RawItem[] = [];

  for (const event of plan.timeline) {
    items.push({
      kind: "event",
      id: event.id,
      startsAt: event.startsAt,
      event,
    });
  }

  for (const suggestion of plan.suggestions) {
    if (suggestion.status === "pending") {
      items.push({
        kind: "pending-suggestion",
        id: suggestion.id,
        startsAt: suggestion.startsAt,
        suggestion,
      });
    } else {
      items.push({
        kind: "added-suggestion",
        id: suggestion.id,
        startsAt: suggestion.startsAt,
        suggestion,
      });
    }
  }

  items.sort((a, b) => a.startsAt.localeCompare(b.startsAt));

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

function buildPinsForDay(
  items: DayTimelineItem[],
  dayIndex: number,
  plan: SchedulePlan,
): MapPin[] {
  const dayColor = getDayColor(dayIndex);
  let pinNumber = 1;
  const pins: MapPin[] = [];

  for (const item of items) {
    if (item.kind === "event") {
      // Events don't always have lat/lng — skip if missing
      // Check if there's a suggestion with matching addedEventId
      continue;
    }

    const suggestion = item.suggestion;
    if (suggestion.place.lat && suggestion.place.lng) {
      pins.push({
        id: item.id,
        lat: suggestion.place.lat,
        lng: suggestion.place.lng,
        label: suggestion.place.name.length > 12
          ? suggestion.place.name.slice(0, 10) + "…"
          : suggestion.place.name,
        number: pinNumber++,
        isSuggestion: item.kind === "pending-suggestion",
        dayColor,
      });
    }
  }

  // Also add events that have location data from suggestions that were added
  for (const item of items) {
    if (item.kind === "event" && !item.event.locked) {
      // This is an added suggestion event — find the matching suggestion for coords
      const matchingSuggestion = plan.suggestions.find(
        (s) => s.addedEventId === item.event.id,
      );
      if (matchingSuggestion?.place.lat && matchingSuggestion?.place.lng) {
        pins.push({
          id: item.id,
          lat: matchingSuggestion.place.lat,
          lng: matchingSuggestion.place.lng,
          label: matchingSuggestion.place.name.length > 12
            ? matchingSuggestion.place.name.slice(0, 10) + "…"
            : matchingSuggestion.place.name,
          number: pinNumber++,
          isSuggestion: false,
          dayColor,
        });
      }
    }
  }

  return pins;
}

function buildAllPins(
  dayGroups: { dayKey: string; dayIndex: number; items: DayTimelineItem[] }[],
  plan: SchedulePlan,
): MapPin[] {
  return dayGroups.flatMap(({ items, dayIndex }) =>
    buildPinsForDay(items, dayIndex, plan),
  );
}

function buildRoutesForDay(pins: MapPin[], dayIndex: number) {
  if (pins.length < 2) return [];
  return [{
    dayColor: getDayColor(dayIndex),
    waypoints: pins.map((p) => ({ lat: p.lat, lng: p.lng })),
  }];
}

function buildAllRoutes(
  dayGroups: { dayKey: string; dayIndex: number; items: DayTimelineItem[] }[],
  plan: SchedulePlan,
) {
  return dayGroups.flatMap(({ items, dayIndex }) => {
    const pins = buildPinsForDay(items, dayIndex, plan);
    return buildRoutesForDay(pins, dayIndex);
  });
}

export function TripResultsPage({ initialPlan, googleMapsApiKey, googleMapsMapId }: Props) {
  const [plan, setPlan] = useState(initialPlan);
  const [activeTab, setActiveTab] = useState<number>(-1); // -1 = overview
  const [pendingSuggestionId, setPendingSuggestionId] = useState<string | null>(null);
  const [calendarAddedIds, setCalendarAddedIds] = useState<Set<string>>(new Set());
  const [highlightedPinId, setHighlightedPinId] = useState<string | null>(null);
  const [hoveredDayIndex, setHoveredDayIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const scheduleTimeZone = resolveTimeZone(
    plan.tripContext.timezone ?? plan.request.importedSchedule.timezone,
  );

  const dayGroups = useMemo(() => buildDayGroups(plan, scheduleTimeZone), [plan, scheduleTimeZone]);
  const dateRange = formatScheduleDateRange(plan.tripContext.tripStart, plan.tripContext.tripEnd, scheduleTimeZone);
  const city = plan.tripContext.cityInference.city ?? "Imported trip";

  // Map data
  const mapPins = useMemo(() => {
    if (activeTab === -1) return buildAllPins(dayGroups, plan);
    const group = dayGroups[activeTab];
    return group ? buildPinsForDay(group.items, group.dayIndex, plan) : [];
  }, [activeTab, dayGroups, plan]);

  const mapRoutes = useMemo(() => {
    if (activeTab === -1) return buildAllRoutes(dayGroups, plan);
    const group = dayGroups[activeTab];
    if (!group) return [];
    const pins = buildPinsForDay(group.items, group.dayIndex, plan);
    return buildRoutesForDay(pins, group.dayIndex);
  }, [activeTab, dayGroups, plan]);

  const legendItems = useMemo(() => {
    if (activeTab !== -1) return [];
    return dayGroups.map(({ dayKey, dayIndex }) => ({
      color: getDayColor(dayIndex).hex,
      label: `Day ${dayIndex + 1}`,
    }));
  }, [activeTab, dayGroups]);

  function addSuggestion(suggestionId: string) {
    setError(null);
    setPendingSuggestionId(suggestionId);

    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/schedule-plans/${plan.id}/suggestions/${suggestionId}/add`,
          { method: "POST", cache: "no-store" },
        );
        const data = (await response.json().catch(() => null)) as
          | (SchedulePlan & { calendarEventCreated?: boolean })
          | { error?: string }
          | null;
        const responseError =
          typeof data === "object" && data && "error" in data ? data.error : null;

        if (!response.ok || !data || responseError) {
          throw new Error(responseError ?? "Unable to add suggestion.");
        }

        const { calendarEventCreated, ...updatedPlan } = data as SchedulePlan & {
          calendarEventCreated?: boolean;
        };
        setPlan(updatedPlan as SchedulePlan);

        if (calendarEventCreated) {
          setCalendarAddedIds((prev) => new Set([...prev, suggestionId]));
        }
      } catch (addError) {
        setError(addError instanceof Error ? addError.message : "Unable to add suggestion.");
      } finally {
        setPendingSuggestionId(null);
      }
    });
  }

  function handlePinClick(pinId: string) {
    setHighlightedPinId(pinId);
  }

  return (
    <main className="flex h-screen flex-col bg-cream">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-warm-100 px-5 py-3">
        <Link href="/plan" className="text-sm text-warm-400 transition-colors hover:text-warm-900">
          ← Back to planner
        </Link>
        <div className="text-center">
          <div className="text-lg font-bold text-warm-900">{city}</div>
          <div className="text-xs text-warm-400">
            {dateRange} · {plan.tripContext.travelDayCount} days
          </div>
        </div>
        <div className="text-xs text-warm-400">
          {/* Export placeholder — future feature */}
        </div>
      </div>

      {/* Day Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-warm-100 px-5 py-2.5">
        <button
          type="button"
          onClick={() => setActiveTab(-1)}
          className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
            activeTab === -1
              ? "bg-gradient-to-r from-coral to-coral-deep text-white"
              : "bg-warm-50 text-warm-600 hover:bg-warm-100"
          }`}
        >
          Overview
        </button>
        {dayGroups.map(({ dayKey, dayIndex }) => (
          <button
            key={dayKey}
            type="button"
            onClick={() => setActiveTab(dayIndex)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === dayIndex
                ? "bg-gradient-to-r from-coral to-coral-deep text-white"
                : "bg-warm-50 text-warm-600 hover:bg-warm-100"
            }`}
          >
            Day {dayIndex + 1} · {formatScheduleDayKeyLabel(dayKey)}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-5 mt-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Split View */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Itinerary */}
        <div className="w-[38%] overflow-y-auto border-r border-warm-100">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              {activeTab === -1 ? (
                <OverviewTab
                  plan={plan}
                  dayGroups={dayGroups}
                  onSelectDay={setActiveTab}
                  onHoverDay={setHoveredDayIndex}
                />
              ) : (
                dayGroups[activeTab] && (
                  <DayTab
                    items={dayGroups[activeTab].items}
                    timeZone={scheduleTimeZone}
                    pendingSuggestionId={pendingSuggestionId}
                    calendarAddedIds={calendarAddedIds}
                    onAddSuggestion={addSuggestion}
                    onItemHover={setHighlightedPinId}
                  />
                )
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right: Map */}
        <div className="flex-1">
          <TripMap
            apiKey={googleMapsApiKey}
            mapId={googleMapsMapId}
            pins={mapPins}
            routes={mapRoutes}
            highlightedPinId={highlightedPinId}
            onPinClick={handlePinClick}
            onPinHover={setHighlightedPinId}
            showLegend={activeTab === -1}
            legendItems={legendItems}
          />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add components/trip-results-page.tsx
git commit -m "feat: create TripResultsPage orchestrator with tabs, map sync, and add-to-calendar flow"
```

---

### Task 12: Update the page route to use `TripResultsPage`

**Files:**
- Modify: `app/plan/[planId]/page.tsx`

Pass the Google Maps API key and map ID as props (server-side env vars).

- [ ] **Step 1: Update the page component**

Replace the contents of `app/plan/[planId]/page.tsx`:

```typescript
import { notFound } from "next/navigation";
import { TripResultsPage } from "@/components/trip-results-page";
import { requirePageAccess } from "@/lib/server/access-gate-server";
import { fetchSchedulePlanRecord } from "@/lib/server/schedule-backend";

export const dynamic = "force-dynamic";

export default async function SchedulePlanPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  await requirePageAccess(`/plan/${planId}`);
  const stored = await fetchSchedulePlanRecord(planId);

  if (!stored) {
    notFound();
  }

  const googleMapsApiKey = process.env.GOOGLE_PLACES_API_KEY ?? "";
  const googleMapsMapId = process.env.GOOGLE_MAPS_MAP_ID ?? "DEMO_MAP_ID";

  return (
    <TripResultsPage
      initialPlan={stored}
      googleMapsApiKey={googleMapsApiKey}
      googleMapsMapId={googleMapsMapId}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/plan/[planId]/page.tsx
git commit -m "feat: wire up TripResultsPage in plan route with Maps API key"
```

---

### Task 13: Remove old components and unused API routes

**Files:**
- Delete: `components/schedule-plan-results.tsx`
- Delete: `components/google-map-frame.tsx`
- Delete: `app/api/maps/embed/route.ts`

- [ ] **Step 1: Delete the old files**

```bash
rm components/schedule-plan-results.tsx
rm components/google-map-frame.tsx
rm app/api/maps/embed/route.ts
```

- [ ] **Step 2: Search for remaining imports of deleted files**

```bash
grep -r "schedule-plan-results\|google-map-frame\|maps/embed" --include="*.ts" --include="*.tsx" app/ components/ lib/
```

Expected: no matches (the page route was already updated in Task 12).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: remove old SchedulePlanResults, GoogleMapFrame, and maps/embed API route"
```

---

### Task 14: Strip generation metadata from client API response

**Files:**
- Modify: `app/api/schedule-plans/[planId]/route.ts`
- Modify: `app/api/schedule-plans/[planId]/suggestions/[suggestionId]/add/route.ts` (already modified in Task 10)

The `generation` field and `workflow.steps[].execution` should not be sent to the client. We'll strip them from the API response rather than changing the backend schema (the backend may still use them internally).

- [ ] **Step 1: Create a response sanitizer utility**

Create `lib/sanitize-plan-response.ts`:

```typescript
import type { SchedulePlan } from "@/lib/types";

/**
 * Strip generation metadata and workflow execution details from a plan
 * before sending to the client. These fields are internal-only.
 */
export function sanitizePlanForClient(plan: SchedulePlan) {
  const { generation, ...rest } = plan;
  return {
    ...rest,
    workflow: {
      ...plan.workflow,
      steps: plan.workflow.steps.map(({ execution, ...step }) => step),
    },
  };
}

export type ClientSchedulePlan = ReturnType<typeof sanitizePlanForClient>;
```

- [ ] **Step 2: Apply sanitizer to the GET endpoint**

Read the current GET endpoint at `app/api/schedule-plans/[planId]/route.ts` and wrap the response with `sanitizePlanForClient`:

Add import at top:
```typescript
import { sanitizePlanForClient } from "@/lib/sanitize-plan-response";
```

Change the success response from:
```typescript
return NextResponse.json(stored);
```
to:
```typescript
return NextResponse.json(sanitizePlanForClient(stored));
```

- [ ] **Step 3: Apply sanitizer to the add endpoint**

In `app/api/schedule-plans/[planId]/suggestions/[suggestionId]/add/route.ts`, add import:
```typescript
import { sanitizePlanForClient } from "@/lib/sanitize-plan-response";
```

Change the success response from:
```typescript
return NextResponse.json({ ...updated, calendarEventCreated });
```
to:
```typescript
return NextResponse.json({ ...sanitizePlanForClient(updated), calendarEventCreated });
```

- [ ] **Step 4: Update TripResultsPage to use ClientSchedulePlan type**

In `components/trip-results-page.tsx`, update the import and Props type:

Add import:
```typescript
import type { ClientSchedulePlan } from "@/lib/sanitize-plan-response";
```

Change Props type:
```typescript
type Props = {
  initialPlan: ClientSchedulePlan;
  googleMapsApiKey: string;
  googleMapsMapId: string;
};
```

Update state:
```typescript
const [plan, setPlan] = useState(initialPlan);
```

Update `addSuggestion` response handling to use `ClientSchedulePlan` instead of `SchedulePlan`.

- [ ] **Step 5: Update the page route to sanitize the plan**

In `app/plan/[planId]/page.tsx`, add import:
```typescript
import { sanitizePlanForClient } from "@/lib/sanitize-plan-response";
```

Change:
```typescript
return (
  <TripResultsPage
    initialPlan={stored}
```
to:
```typescript
return (
  <TripResultsPage
    initialPlan={sanitizePlanForClient(stored)}
```

- [ ] **Step 6: Verify compilation**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```

- [ ] **Step 7: Commit**

```bash
git add lib/sanitize-plan-response.ts app/api/schedule-plans/ components/trip-results-page.tsx app/plan/[planId]/page.tsx
git commit -m "refactor: strip generation metadata from client-facing API responses"
```

---

### Task 15: Verify the full build and manual test

**Files:** None (verification only)

- [ ] **Step 1: Run the type checker**

```bash
npx tsc --noEmit --pretty
```

Expected: no errors.

- [ ] **Step 2: Run the dev server**

```bash
pnpm dev
```

Expected: compiles without errors. Navigate to an existing plan URL (`/plan/<planId>`) and verify:
- Tab bar renders with Overview + day tabs
- Overview tab shows trip summary card and day preview cards
- Clicking a day tab shows the day's itinerary on the left and map on the right
- Suggestion cards expand/collapse
- Map pins appear and highlight on hover
- "Add to trip" works and card transitions to locked style

- [ ] **Step 3: Run existing tests**

```bash
pnpm test
```

Expected: all existing tests pass (we didn't change backend logic, only frontend components and API response shape).

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address build/test issues from trip results redesign"
```

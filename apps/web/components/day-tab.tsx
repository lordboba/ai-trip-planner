"use client";

import { useState } from "react";
import type { NormalizedCalendarEvent, ScheduleSuggestion } from "@/lib/types";
import { AddedSuggestionCard } from "./added-suggestion-card";
import { LockedEventCard } from "./locked-event-card";
import { SuggestionCard } from "./suggestion-card";

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
    <div className="space-y-3 p-4 md:p-5">
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
            onToggle={() => {
              setExpandedSuggestionId((current) => current === item.suggestion.id ? null : item.suggestion.id);
            }}
            onAdd={() => onAddSuggestion(item.suggestion.id)}
            onHover={(hovered) => onItemHover(hovered ? item.id : null)}
          />
        );
      })}

      {items.length === 0 && (
        <div className="flex items-center justify-center rounded-[1.25rem] border border-dashed border-warm-100 bg-white/70 py-12 text-sm text-warm-400">
          No events or suggestions for this day.
        </div>
      )}
    </div>
  );
}

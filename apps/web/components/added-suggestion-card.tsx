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
    <div className="flex items-start gap-3" onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)}>
      <div className="mt-1 min-h-[52px] w-[3px] rounded-sm bg-[#6BC96B]" />
      <div className="min-w-0 flex-1 rounded-[1.1rem] border border-[#6BC96B]/35 bg-white p-3.5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-warm-900">{suggestion.place.name}</div>
            <div className="mt-1 text-[11px] text-warm-400">
              {formatScheduleTimeRange(suggestion.startsAt, suggestion.endsAt, false, timeZone)}
              {" · "}
              {suggestion.category}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[#6BC96B]">
              <span className="text-[10px] font-bold text-white">✓</span>
            </div>
            <span className="text-[10px] font-semibold text-[#509C50]">Added</span>
          </div>
        </div>
        {calendarAdded && (
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-warm-500">
            <span>📅</span>
            <span>Added to Google Calendar</span>
          </div>
        )}
      </div>
    </div>
  );
}

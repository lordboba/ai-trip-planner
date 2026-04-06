"use client";

import type { NormalizedCalendarEvent } from "@/lib/types";
import { formatScheduleTimeRange, titleCaseEventType } from "@/lib/schedule-format";

type LockedEventCardProps = {
  event: NormalizedCalendarEvent;
  timeZone: string;
  mapLabel?: number;
  onHover: (hovered: boolean) => void;
};

export function LockedEventCard({ event, timeZone, mapLabel, onHover }: LockedEventCardProps) {
  return (
    <div className="flex items-start gap-3" onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)}>
      <div className="mt-1 min-h-[52px] w-[3px] rounded-sm bg-warm-900" />
      <div className="min-w-0 flex-1 rounded-[1.1rem] border border-warm-100 bg-white p-3.5 shadow-sm">
        <div className="text-[11px] text-warm-400">
          {formatScheduleTimeRange(event.startsAt, event.endsAt, event.isAllDay, event.timezone ?? timeZone)}
        </div>
        <div className="mt-1 flex items-center gap-2">
          {typeof mapLabel === "number" && (
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-warm-900 text-[10px] font-semibold text-white">
              {mapLabel}
            </div>
          )}
          <div className="text-sm font-semibold text-warm-900">{event.title}</div>
        </div>
        {event.location ? (
          <div className="mt-1 text-[11px] text-warm-400">{event.location}</div>
        ) : (
          event.type !== "other" && <div className="mt-1 text-[11px] text-warm-400">{titleCaseEventType(event.type)}</div>
        )}
      </div>
    </div>
  );
}

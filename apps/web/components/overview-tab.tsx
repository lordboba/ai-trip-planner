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
  const pendingSuggestions = plan.suggestions.filter((suggestion) => suggestion.status === "pending");
  const totalEstimatedCost = plan.suggestions
    .filter((suggestion) => suggestion.status === "added")
    .reduce((sum, suggestion) => {
      const parsed = Number.parseFloat(suggestion.estimatedCost.replace(/[^0-9.]/g, ""));
      return sum + (Number.isNaN(parsed) ? 0 : parsed);
    }, 0);

  return (
    <div className="space-y-4 p-4 md:p-5">
      <div className="rounded-[1.5rem] bg-gradient-to-br from-warm-900 via-warm-700 to-coral-deep p-4 text-white shadow-[0_18px_40px_rgba(26,22,20,0.2)]">
        <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">Trip summary</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-2xl font-bold">{plan.tripContext.travelDayCount}</div>
            <div className="text-[11px] text-white/60">Days</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{plan.timeline.length}</div>
            <div className="text-[11px] text-white/60">Events</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{pendingSuggestions.length}</div>
            <div className="text-[11px] text-white/60">Suggestions</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{totalEstimatedCost > 0 ? `~$${Math.round(totalEstimatedCost)}` : "—"}</div>
            <div className="text-[11px] text-white/60">Est. budget</div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-white/12 pt-4">
          {plan.request.preferences.interests.map((interest) => (
            <span key={interest} className="rounded-full bg-white/12 px-2 py-0.5 text-[10px]">
              {interest}
            </span>
          ))}
          <span className="rounded-full bg-white/12 px-2 py-0.5 text-[10px]">{plan.request.preferences.pace}</span>
          <span className="rounded-full bg-white/12 px-2 py-0.5 text-[10px]">{plan.request.preferences.transport}</span>
          <span className="rounded-full bg-white/12 px-2 py-0.5 text-[10px]">{plan.request.preferences.budgetBand}</span>
        </div>
      </div>

      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-warm-400">Day by day</div>

      {dayGroups.map(({ dayKey, dayIndex, items }) => {
        const dayColor = getDayColor(dayIndex);

        return (
          <div
            key={dayKey}
            onClick={() => onSelectDay(dayIndex)}
            onMouseEnter={() => onHoverDay(dayIndex)}
            onMouseLeave={() => onHoverDay(null)}
            className="cursor-pointer rounded-[1.2rem] border border-warm-100 bg-white p-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            style={{ borderLeftWidth: "4px", borderLeftColor: dayColor.hex }}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[13px] font-bold text-warm-900">
                Day {dayIndex + 1} · {formatScheduleDayKeyLabel(dayKey)}
              </div>
              <span className="text-sm text-warm-400/55">→</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {items.map((item) => {
                const label = item.kind === "event" ? item.event.title : item.suggestion.place.name;
                const isSuggestion = item.kind !== "event";

                return (
                  <span
                    key={item.id}
                    className={`rounded-md px-2 py-0.5 text-[10px] ${
                      isSuggestion
                        ? "border border-dashed border-coral/35 bg-coral-wash text-coral-deep"
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

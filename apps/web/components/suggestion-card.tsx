"use client";

import { AnimatePresence, motion } from "framer-motion";
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

function getCategoryIcon(category: string) {
  const lower = category.toLowerCase();

  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (lower.includes(key)) {
      return icon;
    }
  }

  return "📍";
}

type SuggestionCardProps = {
  suggestion: ScheduleSuggestion;
  timeZone: string;
  isExpanded: boolean;
  isPending: boolean;
  mapLabel?: number;
  onToggle: () => void;
  onAdd: () => void;
  onHover: (hovered: boolean) => void;
};

export function SuggestionCard({
  suggestion,
  timeZone,
  isExpanded,
  isPending,
  mapLabel,
  onToggle,
  onAdd,
  onHover,
}: SuggestionCardProps) {
  const icon = getCategoryIcon(suggestion.category);
  const startTime = formatScheduleTimeRange(suggestion.startsAt, suggestion.endsAt, false, timeZone).split(" - ")[0];

  return (
    <div onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)}>
      <div
        onClick={onToggle}
        className={`cursor-pointer rounded-[1.15rem] border transition-all duration-200 ${
          isExpanded
            ? "border-coral bg-[linear-gradient(135deg,#fff8f5,#fff)] shadow-[0_10px_30px_rgba(255,107,66,0.14)]"
            : "border-dashed border-coral/35 bg-[linear-gradient(135deg,#fff8f5,#fff)]"
        }`}
      >
        <div className="flex items-center justify-between gap-3 p-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-coral-wash text-sm">
              {icon}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {typeof mapLabel === "number" && (
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-coral text-[10px] font-semibold text-white">
                    {mapLabel}
                  </div>
                )}
                <div className="truncate text-[13px] font-semibold text-warm-900">{suggestion.place.name}</div>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-warm-400">
                <span className="font-semibold text-coral">★ {suggestion.place.rating.toFixed(1)}</span>
                <span>· {suggestion.category}</span>
                <span>· {startTime}</span>
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

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="border-t border-coral/15 px-3.5 pb-3.5 pt-3">
                <div className="mb-3 rounded-xl bg-warm-50 p-3">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-warm-400">
                    Why this spot
                  </div>
                  <div className="text-[13px] leading-relaxed text-warm-900">{suggestion.message}</div>
                </div>

                <div className="mb-3 flex flex-wrap gap-4">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-warm-400">Duration</div>
                    <div className="text-[13px] font-semibold text-warm-900">~{suggestion.estimatedDurationMinutes} min</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-warm-400">Time</div>
                    <div className="text-[13px] font-semibold text-warm-900">
                      {formatScheduleTimeRange(suggestion.startsAt, suggestion.endsAt, false, timeZone)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-warm-400">Cost</div>
                    <div className="text-[13px] font-semibold text-warm-900">{suggestion.estimatedCost}</div>
                  </div>
                </div>

                {suggestion.place.reviewSnippets.length > 0 && (
                  <p className="mb-3 text-xs italic leading-relaxed text-warm-500">
                    &ldquo;{suggestion.place.reviewSnippets[0]}&rdquo;
                  </p>
                )}

                {suggestion.transitNote && (
                  <div className="mb-3 flex items-center gap-1.5 text-[11px] text-warm-500">
                    <span>🚃</span>
                    <span>{suggestion.transitNote}</span>
                  </div>
                )}

                <div className="flex gap-2" onClick={(event) => event.stopPropagation()}>
                  <button
                    type="button"
                    onClick={onAdd}
                    disabled={isPending}
                    className="flex-1 rounded-xl bg-gradient-to-r from-coral to-coral-deep px-4 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-92 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {isPending ? "Adding..." : "Add to trip"}
                  </button>
                  {suggestion.place.googleMapsUri && (
                    <a
                      href={suggestion.place.googleMapsUri}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl bg-warm-50 px-3.5 py-2.5 text-[13px] font-semibold text-warm-500 transition-colors hover:bg-warm-100"
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

"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import type { NormalizedCalendarEvent, SchedulePlan, ScheduleSuggestion } from "@/lib/types";
import {
  formatScheduleDateRange,
  formatScheduleDayKeyLabel,
  formatScheduleTimeRange,
  titleCaseEventType,
} from "@/lib/schedule-format";
import { getTimeZoneDayKey, resolveTimeZone } from "@/lib/timezone";

type Props = {
  initialPlan: SchedulePlan;
};

type TimelineItem =
  | { kind: "event"; key: string; startsAt: string; event: NormalizedCalendarEvent }
  | { kind: "suggestion"; key: string; startsAt: string; suggestion: ScheduleSuggestion };

function groupTimeline(plan: SchedulePlan, timeZone: string) {
  const items: TimelineItem[] = [
    ...plan.timeline.map((event) => ({
      kind: "event" as const,
      key: event.id,
      startsAt: event.startsAt,
      event,
    })),
    ...plan.suggestions
      .filter((suggestion) => suggestion.status === "pending")
      .map((suggestion) => ({
        kind: "suggestion" as const,
        key: suggestion.id,
        startsAt: suggestion.startsAt,
        suggestion,
      })),
  ].sort((left, right) => left.startsAt.localeCompare(right.startsAt));

  const groups = new Map<string, TimelineItem[]>();

  for (const item of items) {
    const dayKey = getTimeZoneDayKey(item.startsAt, timeZone);
    const existing = groups.get(dayKey) ?? [];
    existing.push(item);
    groups.set(dayKey, existing);
  }

  return [...groups.entries()];
}

export function SchedulePlanResults({ initialPlan }: Props) {
  const [plan, setPlan] = useState(initialPlan);
  const [pendingSuggestionId, setPendingSuggestionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const scheduleTimeZone = resolveTimeZone(plan.tripContext.timezone ?? plan.request.importedSchedule.timezone);

  const groupedTimeline = useMemo(() => groupTimeline(plan, scheduleTimeZone), [plan, scheduleTimeZone]);
  const dateRange = formatScheduleDateRange(plan.tripContext.tripStart, plan.tripContext.tripEnd, scheduleTimeZone);
  const city = plan.tripContext.cityInference.city ?? "Imported trip";
  const pendingSuggestions = plan.suggestions.filter((suggestion) => suggestion.status === "pending");
  const addedSuggestions = plan.suggestions.filter((suggestion) => suggestion.status === "added");

  function addSuggestion(suggestionId: string) {
    setError(null);
    setPendingSuggestionId(suggestionId);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/schedule-plans/${plan.id}/suggestions/${suggestionId}/add`, {
          method: "POST",
          cache: "no-store",
        });
        const data = (await response.json().catch(() => null)) as SchedulePlan | { error?: string } | null;
        const responseError = typeof data === "object" && data && "error" in data ? data.error : null;

        if (!response.ok || !data || responseError) {
          throw new Error(responseError ?? "Unable to add suggestion.");
        }

        setPlan(data as SchedulePlan);
      } catch (addError) {
        setError(addError instanceof Error ? addError.message : "Unable to add suggestion.");
      } finally {
        setPendingSuggestionId(null);
      }
    });
  }

  return (
    <main className="min-h-screen bg-cream">
      <section className="relative overflow-hidden bg-gradient-to-br from-warm-900 via-warm-600 to-coral-deep px-4 py-10 text-white md:px-6 md:py-14">
        <div className="absolute inset-y-0 right-0 hidden w-96 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.16),transparent_58%)] lg:block" />
        <div className="relative mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/plan" className="text-sm text-white/65 transition-colors hover:text-white">
              ← Back to planner
            </Link>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/82">
                {plan.request.preferences.provider === "openai" ? "OpenAI" : "Claude"}
              </span>
              <span className="rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/82">
                {plan.request.preferences.transport}
              </span>
            </div>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-coral-light">Timeline plan</p>
              <h1 className="mt-3 text-3xl font-extrabold md:text-5xl">{city}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/72 md:text-base">
                Existing events stay locked. Suggested stops are positioned directly inside the day where they fit,
                so the workflow stays focused on adding only the windows worth taking.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-xs font-semibold text-white/82">
                  {dateRange}
                </span>
                <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-xs font-semibold text-white/82">
                  {plan.timeline.length} timeline items
                </span>
                <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-xs font-semibold text-white/82">
                  {pendingSuggestions.length} pending suggestions
                </span>
                <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-xs font-semibold text-white/82">
                  {plan.request.preferences.earliestTime} to {plan.request.preferences.latestTime}
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-[1.5rem] border border-white/12 bg-white/10 p-4 backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-coral-light">Locked events</p>
                <p className="mt-3 text-3xl font-extrabold">{plan.request.importedSchedule.events.length}</p>
                <p className="mt-1 text-sm text-white/65">Imported from the original calendar.</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/12 bg-white/10 p-4 backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-coral-light">Open windows</p>
                <p className="mt-3 text-3xl font-extrabold">{plan.slots.length}</p>
                <p className="mt-1 text-sm text-white/65">Classified as quick stops or meal windows.</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/12 bg-white/10 p-4 backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-coral-light">Added</p>
                <p className="mt-3 text-3xl font-extrabold">{addedSuggestions.length}</p>
                <p className="mt-1 text-sm text-white/65">Suggestions already accepted into the timeline.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 md:px-6 lg:grid-cols-[1.22fr_0.78fr]">
        <section className="space-y-5">
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {groupedTimeline.map(([dayKey, items], index) => (
            <motion.div
              key={dayKey}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: index * 0.05 }}
              className="rounded-[1.75rem] border border-warm-100 bg-white p-5 shadow-[0_24px_70px_rgba(26,22,20,0.08)]"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-coral">Day</p>
                  <h2 className="mt-1 text-xl font-extrabold text-warm-900">
                    {formatScheduleDayKeyLabel(dayKey)}
                  </h2>
                </div>
                <span className="rounded-full border border-warm-100 bg-warm-50 px-3 py-1.5 text-xs font-semibold text-warm-400">
                  {items.length} items
                </span>
              </div>

              <div className="space-y-3">
                {items.map((item) => (
                  item.kind === "event" ? (
                    <div
                      key={item.key}
                      className={`rounded-[1.4rem] border p-4 ${
                        item.event.locked
                          ? "border-warm-100 bg-cream"
                          : "border-coral/20 bg-coral-wash"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-coral">
                            {item.event.locked ? "Locked event" : "Added suggestion"}
                          </p>
                          <h3 className="mt-1 text-sm font-bold text-warm-900">{item.event.title}</h3>
                          <p className="mt-2 text-sm leading-6 text-warm-400">
                            {item.event.location ?? "No location"}{item.event.description ? ` · ${item.event.description}` : ""}
                          </p>
                        </div>
                        <div className="text-left md:text-right">
                          <p className="text-sm font-semibold text-warm-900">
                            {formatScheduleTimeRange(
                              item.event.startsAt,
                              item.event.endsAt,
                              item.event.isAllDay,
                              item.event.timezone ?? scheduleTimeZone,
                            )}
                          </p>
                          <p className="mt-1 text-xs text-warm-400">{titleCaseEventType(item.event.type)}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={item.key}
                      className="rounded-[1.4rem] border border-dashed border-coral/35 bg-[linear-gradient(135deg,rgba(255,245,240,1),rgba(255,255,255,1))] p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-coral">Suggested stop</p>
                          <h3 className="mt-1 text-sm font-bold text-warm-900">{item.suggestion.title}</h3>
                          <p className="mt-1 text-xs font-semibold text-warm-400">{item.suggestion.subtitle}</p>
                          <p className="mt-3 text-sm leading-6 text-warm-400">{item.suggestion.message}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-full border border-coral/15 bg-white px-3 py-1.5 text-xs font-semibold text-coral-deep">
                              {item.suggestion.estimatedCost}
                            </span>
                            <span className="rounded-full border border-coral/15 bg-white px-3 py-1.5 text-xs font-semibold text-coral-deep">
                              {item.suggestion.estimatedDurationMinutes} min
                            </span>
                            <span className="rounded-full border border-coral/15 bg-white px-3 py-1.5 text-xs font-semibold text-coral-deep">
                              {item.suggestion.category}
                            </span>
                          </div>
                        </div>
                        <div className="w-full md:w-auto md:text-right">
                          <p className="text-sm font-semibold text-warm-900">
                            {formatScheduleTimeRange(
                              item.suggestion.startsAt,
                              item.suggestion.endsAt,
                              false,
                              scheduleTimeZone,
                            )}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-warm-400">{item.suggestion.transitNote}</p>
                          <button
                            type="button"
                            onClick={() => addSuggestion(item.suggestion.id)}
                            disabled={isPending}
                            className="mt-4 rounded-xl bg-coral px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-coral-deep disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            {pendingSuggestionId === item.suggestion.id ? "Adding..." : item.suggestion.actionLabel}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                ))}
              </div>
            </motion.div>
          ))}
        </section>

        <aside className="space-y-5">
          <div className="rounded-[1.75rem] border border-warm-100 bg-white p-5 shadow-[0_24px_70px_rgba(26,22,20,0.08)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-coral">Trip context</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-warm-100 bg-cream p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-warm-400">City inference</p>
                <p className="mt-2 text-sm font-bold text-warm-900">
                  {plan.tripContext.cityInference.city ?? "Unknown city"}
                </p>
                <p className="mt-1 text-xs text-warm-400">
                  {Math.round(plan.tripContext.cityInference.confidence * 100)}% confidence
                </p>
              </div>
              <div className="rounded-2xl border border-warm-100 bg-cream p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-warm-400">Preferences</p>
                <p className="mt-2 text-sm font-bold text-warm-900">
                  {plan.request.preferences.budgetBand} · {plan.request.preferences.pace}
                </p>
                <p className="mt-1 text-xs text-warm-400">
                  {plan.request.preferences.interests.join(", ") || "No interests selected"}
                </p>
              </div>
              <div className="rounded-2xl border border-warm-100 bg-cream p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-warm-400">Notes</p>
                <p className="mt-2 text-sm leading-6 text-warm-400">
                  {plan.request.preferences.comments || "No extra planning notes provided."}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-warm-100 bg-white p-5 shadow-[0_24px_70px_rgba(26,22,20,0.08)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-coral">Imported warnings</p>
            {plan.request.importedSchedule.warnings.length ? (
              <div className="mt-4 space-y-3">
                {plan.request.importedSchedule.warnings.map((warning) => (
                  <p key={warning} className="rounded-2xl border border-warm-100 bg-cream p-4 text-sm leading-6 text-warm-400">
                    {warning}
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-2xl border border-warm-100 bg-cream p-4 text-sm leading-6 text-warm-400">
                No import warnings. The calendar parsed cleanly.
              </p>
            )}
          </div>

          <div className="rounded-[1.75rem] border border-warm-100 bg-white p-5 shadow-[0_24px_70px_rgba(26,22,20,0.08)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-coral">Plan status</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-2xl border border-warm-100 bg-cream p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-warm-400">Pending</p>
                <p className="mt-2 text-2xl font-extrabold text-warm-900">{pendingSuggestions.length}</p>
              </div>
              <div className="rounded-2xl border border-warm-100 bg-cream p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-warm-400">Added</p>
                <p className="mt-2 text-2xl font-extrabold text-warm-900">{addedSuggestions.length}</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

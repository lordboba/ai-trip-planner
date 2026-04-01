"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getSavedTrips, type SavedTripSnapshot } from "@/lib/browser-saved-trips";
import {
  DEFAULT_PLANNING_EARLIEST_TIME,
  DEFAULT_PLANNING_LATEST_TIME,
  isPlanningWindowValid,
} from "@/lib/timezone";
import type {
  BudgetBand,
  ImportedCalendar,
  LLMProvider,
  Pace,
  SchedulePlanPreferences,
} from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Options                                                            */
/* ------------------------------------------------------------------ */

const interestOptions = [
  { label: "Food", value: "food" },
  { label: "Nightlife", value: "nightlife" },
  { label: "Nature", value: "nature" },
  { label: "Culture", value: "culture" },
  { label: "Shopping", value: "shopping" },
  { label: "Wellness", value: "wellness" },
  { label: "Adventure", value: "adventure" },
  { label: "Hidden Gems", value: "hidden gems" },
];

const budgetOptions: { label: string; value: BudgetBand }[] = [
  { label: "Lean", value: "lean" },
  { label: "Comfort", value: "comfort" },
  { label: "Luxury", value: "luxury" },
];

const paceOptions: { label: string; value: Pace }[] = [
  { label: "Relaxed", value: "relaxed" },
  { label: "Balanced", value: "balanced" },
  { label: "Packed", value: "packed" },
];

const transportOptions = [
  { label: "Walk", value: "walk" },
  { label: "Transit", value: "transit" },
  { label: "Rideshare", value: "rideshare" },
  { label: "Rental car", value: "rental-car" },
  { label: "Mixed", value: "mixed" },
] as const;

const planningTimeOptions = Array.from({ length: 38 }, (_, index) => {
  const totalMinutes = 5 * 60 + index * 30;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const value = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  const label = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(`2000-01-01T${value}:00`));

  return { value, label };
});

/* ------------------------------------------------------------------ */
/*  Style helpers                                                      */
/* ------------------------------------------------------------------ */

const inputClasses =
  "w-full px-3 py-2.5 rounded-xl bg-warm-50 border border-warm-100 text-warm-900 text-sm focus:outline-none focus:border-coral focus:ring-1 focus:ring-coral/30";
const labelClasses =
  "block text-xs font-semibold uppercase tracking-widest text-warm-400 mb-1.5";

function pill(active: boolean) {
  return active
    ? "bg-coral text-white"
    : "bg-warm-50 text-warm-600 border border-warm-100 hover:border-warm-400";
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function datesValid(start: string, end: string) {
  return start !== "" && end !== "" && end >= start;
}

function toggleValue(arr: string[], v: string) {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

type PlannerShellProps = {
  googleCalendarState: string | null;
  googleCalendarStartDate: string | null;
  googleCalendarEndDate: string | null;
};

export function PlannerShell({
  googleCalendarState,
  googleCalendarStartDate,
  googleCalendarEndDate,
}: PlannerShellProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ---- Calendar state ---- */
  const [calendarFile, setCalendarFile] = useState<File | null>(null);
  const [importedCalendar, setImportedCalendar] = useState<ImportedCalendar | null>(null);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [googleStatus, setGoogleStatus] = useState<string | null>(null);

  /* ---- Core fields ---- */
  const [startDate, setStartDate] = useState(todayString());
  const [endDate, setEndDate] = useState(todayString());
  const [earliestTime, setEarliestTime] = useState(DEFAULT_PLANNING_EARLIEST_TIME);
  const [latestTime, setLatestTime] = useState(DEFAULT_PLANNING_LATEST_TIME);

  /* ---- Advanced preferences ---- */
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [provider, setProvider] = useState<LLMProvider>("openai");
  const [budgetBand, setBudgetBand] = useState<BudgetBand>("comfort");
  const [pace, setPace] = useState<Pace>("balanced");
  const [interests, setInterests] = useState<string[]>(["food", "culture", "hidden gems"]);
  const [transport, setTransport] = useState<(typeof transportOptions)[number]["value"]>("mixed");
  const [comments, setComments] = useState("");

  /* ---- Submission ---- */
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  /* ---- Saved trips ---- */
  const [savedTrips] = useState<SavedTripSnapshot[]>(() => {
    if (typeof window === "undefined") return [];
    return getSavedTrips();
  });

  /* ---- Derived city label ---- */
  const inferredCity = importedCalendar?.cityInference?.city ?? null;
  const planningWindowIsValid = isPlanningWindowValid(earliestTime, latestTime);

  /* ---- Can generate? ---- */
  const canGenerate = useMemo(
    () => importedCalendar !== null && datesValid(startDate, endDate) && planningWindowIsValid,
    [importedCalendar, startDate, endDate, planningWindowIsValid],
  );

  const resetImportedCalendar = useCallback(() => {
    setImportedCalendar(null);
    setCalendarFile(null);
    setCalendarError(null);
    setGoogleStatus(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  /* ---- Import ICS file ---- */
  const importIcs = useCallback(async (file: File) => {
    setCalendarError(null);
    setGoogleStatus(null);
    setIsImporting(true);
    setImportedCalendar(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (startDate) formData.append("startDate", startDate);
      if (endDate) formData.append("endDate", endDate);

      const res = await fetch("/api/calendar/import", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Calendar import failed.");
      }

      const imported = (await res.json()) as ImportedCalendar;
      setImportedCalendar(imported);
    } catch (err) {
      setCalendarError(err instanceof Error ? err.message : "Calendar import failed.");
    } finally {
      setIsImporting(false);
    }
  }, [startDate, endDate]);

  /* ---- Google Calendar connect ---- */
  const connectGoogle = useCallback(async () => {
    setCalendarError(null);
    setGoogleStatus(null);
    setIsConnecting(true);

    try {
      const res = await fetch("/api/calendar/google/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate }),
      });
      if (!res.ok) throw new Error("Google Calendar connection failed.");
      const data = (await res.json()) as { message?: string; authorizeUrl?: string };

      if (data.authorizeUrl) {
        window.location.href = data.authorizeUrl;
        return;
      }

      setGoogleStatus(data.message ?? "Connected.");
    } catch (err) {
      setCalendarError(err instanceof Error ? err.message : "Google Calendar connection failed.");
    } finally {
      setIsConnecting(false);
    }
  }, [endDate, startDate]);



  useEffect(() => {
    if (googleCalendarState === "error") {
      setCalendarError("Google Calendar authentication failed. Please try connecting again.");
      setGoogleStatus(null);
      router.replace("/plan");
      return;
    }

    if (googleCalendarState !== "connected") {
      return;
    }

    const selectedStartDate =
      datesValid(googleCalendarStartDate ?? "", googleCalendarEndDate ?? "")
        ? (googleCalendarStartDate as string)
        : startDate;
    const selectedEndDate =
      datesValid(googleCalendarStartDate ?? "", googleCalendarEndDate ?? "")
        ? (googleCalendarEndDate as string)
        : endDate;

    if (selectedStartDate !== startDate) {
      setStartDate(selectedStartDate);
    }

    if (selectedEndDate !== endDate) {
      setEndDate(selectedEndDate);
    }

    router.replace("/plan");

    const importGoogle = async () => {
      setCalendarError(null);
      setGoogleStatus("Importing Google Calendar events...");

      try {
        const res = await fetch("/api/calendar/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: "google", startDate: selectedStartDate, endDate: selectedEndDate }),
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? "Google Calendar import failed.");
        }

        const imported = (await res.json()) as ImportedCalendar;
        setImportedCalendar(imported);
        setGoogleStatus(`Connected. Imported ${imported.events.length} Google Calendar events.`);
      } catch (err) {
        setCalendarError(err instanceof Error ? err.message : "Google Calendar import failed.");
      }
    };

    void importGoogle();
  }, [googleCalendarEndDate, googleCalendarStartDate, googleCalendarState, router]);

  const handleStartDateChange = useCallback((value: string) => {
    setStartDate(value);
    resetImportedCalendar();
  }, [resetImportedCalendar]);

  const handleEndDateChange = useCallback((value: string) => {
    setEndDate(value);
    resetImportedCalendar();
  }, [resetImportedCalendar]);

  /* ---- Generate plan ---- */
  function generate() {
    if (!importedCalendar) return;
    setError(null);

    const preferences: SchedulePlanPreferences = {
      provider,
      budgetBand,
      interests,
      pace,
      transport,
      earliestTime,
      latestTime,
      comments,
    };

    const payload = {
      importedSchedule: importedCalendar,
      preferences,
      startDate,
      endDate,
    };

    startTransition(async () => {
      try {
        const res = await fetch("/api/schedule-plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Plan generation failed.");
        const data = (await res.json()) as { planId: string };
        router.push(`/plan/${data.planId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to generate plan.");
      }
    });
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="w-full max-w-lg">
      {/* Saved trips */}
      {savedTrips.length > 0 && (
        <div className="mb-5 rounded-2xl border border-warm-600 bg-warm-800/70 p-4 text-white shadow-[0_18px_50px_rgba(26,22,20,0.18)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-coral-light">
                Saved in this browser
              </p>
              <h2 className="mt-1 text-sm font-bold">Recent trip outputs</h2>
            </div>
            <p className="text-[11px] text-white/55">{savedTrips.length} stored locally</p>
          </div>
          <div className="space-y-2">
            {savedTrips.slice(0, 3).map((trip) => (
              <button
                key={trip.id}
                type="button"
                onClick={() => router.push(`/trip/local/${trip.id}`)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left transition-colors hover:bg-white/10"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {trip.plan.destinationSummary.title}
                  </p>
                  <p className="mt-1 truncate text-xs text-white/60">
                    {trip.request.travelerProfile.startDate} to{" "}
                    {trip.request.travelerProfile.endDate} ·{" "}
                    {trip.request.travelerProfile.budgetBand}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-coral-light">Open</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main card */}
      <div className="bg-cream rounded-2xl shadow-xl p-6 md:p-8">
        <h2 className="text-xl font-extrabold text-warm-900 mb-1">Drop your schedule</h2>
        <p className="text-sm text-warm-400 mb-6">
          Upload your work calendar and we&apos;ll find every free window, then fill it with the
          best spots nearby.
        </p>

        {/* ── Section 1: Calendar ── */}
        <div className="mb-6">
          <label className={labelClasses}>Your schedule</label>

          {/* Upload area */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".ics,text/calendar"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setCalendarFile(file);
                importIcs(file);
              }
            }}
          />

          {!importedCalendar ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting || !datesValid(startDate, endDate)}
                className="w-full rounded-xl border-2 border-dashed border-warm-100 bg-warm-50 px-4 py-6 text-center transition-colors hover:border-coral/40 hover:bg-coral-wash disabled:opacity-50"
              >
                {isImporting ? (
                  <span className="text-sm text-warm-400">Importing calendar...</span>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-warm-900">
                      Upload .ics file
                    </p>
                    <p className="mt-1 text-xs text-warm-400">
                      Export from Google Calendar, Outlook, or Apple Calendar
                    </p>
                  </>
                )}
              </button>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-warm-100" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-warm-400">
                  or
                </span>
                <div className="h-px flex-1 bg-warm-100" />
              </div>

              <button
                type="button"
                onClick={connectGoogle}
                disabled={isConnecting || !datesValid(startDate, endDate)}
                className="w-full rounded-xl border border-warm-100 bg-white px-4 py-3 text-sm font-semibold text-warm-900 transition-colors hover:border-coral/40 hover:bg-coral-wash"
              >
                {isConnecting ? "Connecting Google Calendar..." : "Connect Google Calendar"}
              </button>

              {googleStatus && (
                <p className="text-xs text-warm-400">{googleStatus}</p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-coral/20 bg-coral-wash px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-warm-900">
                    {calendarFile?.name ?? "Calendar imported"}
                  </p>
                  <p className="mt-0.5 text-xs text-warm-400">
                    {importedCalendar.events.length} events
                    {inferredCity ? ` · ${inferredCity}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetImportedCalendar}
                  className="shrink-0 text-xs font-semibold text-coral hover:text-coral-deep"
                >
                  Remove
                </button>
              </div>
            </div>
          )}

          {calendarError && (
            <p className="mt-2 text-xs text-red-500">{calendarError}</p>
          )}
        </div>

        {/* ── Section 2: Dates ── */}
        <div className="mb-6">
          <label className={labelClasses}>Trip dates</label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className={inputClasses}
                aria-label="Start date"
              />
            </div>
            <div>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className={inputClasses}
                aria-label="End date"
              />
            </div>
          </div>
          {startDate && endDate && endDate < startDate && (
            <p className="mt-1.5 text-xs text-red-500">End date must be on or after start date.</p>
          )}
        </div>

        {/* ── Section 3: Planning hours ── */}
        <div className="mb-6">
          <label className={labelClasses}>Planning hours</label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <select
                value={earliestTime}
                onChange={(e) => setEarliestTime(e.target.value)}
                className={inputClasses}
                aria-label="Earliest planning time"
              >
                {planningTimeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <select
                value={latestTime}
                onChange={(e) => setLatestTime(e.target.value)}
                className={inputClasses}
                aria-label="Latest planning time"
              >
                {planningTimeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="mt-2 text-xs text-warm-400">
            Suggestions will only be placed inside this daily time window.
          </p>
          {!planningWindowIsValid && (
            <p className="mt-1.5 text-xs text-red-500">Latest time must be after earliest time.</p>
          )}
        </div>

        {/* ── Advanced settings toggle ── */}
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="mb-4 flex w-full items-center justify-between rounded-xl border border-warm-100 bg-warm-50 px-4 py-2.5 text-left transition-colors hover:bg-warm-50/80"
        >
          <span className="text-xs font-semibold uppercase tracking-widest text-warm-400">
            Advanced settings
          </span>
          <span className="text-warm-400 text-sm">{showAdvanced ? "−" : "+"}</span>
        </button>

        {showAdvanced && (
          <div className="mb-6 space-y-5 rounded-xl border border-warm-100 bg-warm-50/50 p-4">
            {/* Provider */}
            <div>
              <label className={labelClasses}>AI provider</label>
              <div className="flex gap-2">
                {(["openai", "claude"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setProvider(p)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${pill(p === provider)}`}
                  >
                    {p === "openai" ? "OpenAI" : "Claude"}
                  </button>
                ))}
              </div>
            </div>

            {/* Budget */}
            <div>
              <label className={labelClasses}>Budget</label>
              <div className="flex gap-2">
                {budgetOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setBudgetBand(opt.value)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${pill(opt.value === budgetBand)}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Pace */}
            <div>
              <label className={labelClasses}>Pace</label>
              <div className="flex gap-2">
                {paceOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPace(opt.value)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${pill(opt.value === pace)}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Interests */}
            <div>
              <label className={labelClasses}>Interests</label>
              <div className="flex flex-wrap gap-2">
                {interestOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setInterests((c) => toggleValue(c, opt.value))}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${pill(interests.includes(opt.value))}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Transport */}
            <div>
              <label className={labelClasses}>Getting around</label>
              <div className="flex flex-wrap gap-2">
                {transportOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTransport(opt.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${pill(opt.value === transport)}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Comments */}
            <div>
              <label htmlFor="comments" className={labelClasses}>
                Anything else?
              </label>
              <textarea
                id="comments"
                rows={2}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Dietary restrictions, must-see spots, things to avoid..."
                className={`${inputClasses} resize-none`}
              />
            </div>
          </div>
        )}

        {/* ── Generate ── */}
        {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

        <button
          type="button"
          disabled={!canGenerate || isPending}
          onClick={generate}
          className="w-full rounded-xl bg-coral py-3 text-sm font-semibold text-white transition-colors hover:bg-coral-deep disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? "Scanning your gaps..." : "Find hidden gems"}
        </button>

        {!importedCalendar && (
          <p className="mt-2 text-center text-xs text-warm-400">
            Upload your schedule to get started
          </p>
        )}
      </div>
    </div>
  );
}

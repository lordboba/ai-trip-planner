"use client";

import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { onboardingSteps } from "@/lib/onboarding";
import { GoogleMapFrame } from "@/components/google-map-frame";
import { getSavedTrips, type SavedTripSnapshot } from "@/lib/browser-saved-trips";
import type {
  BudgetBand,
  DestinationIntent,
  LLMProvider,
  Pace,
  SurpriseTolerance,
  TripRequest,
  TripType,
} from "@/lib/types";

const interestOptions = [
  { label: "🍜 Food", value: "food" },
  { label: "🎉 Nightlife", value: "nightlife" },
  { label: "🌿 Nature", value: "nature" },
  { label: "🎨 Culture", value: "culture" },
  { label: "🛍️ Shopping", value: "shopping" },
  { label: "🧘 Wellness", value: "wellness" },
  { label: "🏔️ Adventure", value: "adventure" },
  { label: "👨‍👩‍👧 Family", value: "family-friendly" },
  { label: "💎 Hidden Gems", value: "hidden gems" },
];

const budgetOptions = [
  { icon: "🎒", label: "Lean", value: "lean" as const },
  { icon: "✨", label: "Comfort", value: "comfort" as const },
  { icon: "👑", label: "Luxury", value: "luxury" as const },
];

const providerCopy: Record<LLMProvider, string> = {
  openai: "Faster itinerary drafting and tool-first orchestration.",
  claude: "Strong long-form reasoning for taste and trip narrative.",
};

const stepEmojis = ["🧭", "📅", "💰", "🚧", "🏨", "✅"];

type FormState = {
  provider: LLMProvider;
  tripType: TripType;
  startDate: string;
  endDate: string;
  dateFlexibility: string;
  destinationIntent: DestinationIntent;
  destinationQuery: string;
  destinationPlaceId?: string;
  budgetBand: BudgetBand;
  splurgeTolerance: number;
  pace: Pace;
  interests: string[];
  constraintsNotes: string;
  lodgingStyle: string;
  neighborhoodVibe: string;
  mustHaves: string;
  hardNos: string;
  loyaltyPrograms: string;
  surpriseTolerance: SurpriseTolerance;
};

type DestinationSuggestion = {
  placeId: string;
  text: string;
  mainText: string;
  secondaryText: string;
  types: string[];
};

type AutocompleteResponse = {
  suggestions: DestinationSuggestion[];
  live: boolean;
  reason: string | null;
};

const initialState: FormState = {
  provider: "openai",
  tripType: "couple",
  startDate: "2026-06-14",
  endDate: "2026-06-18",
  dateFlexibility: "Weekend in June works too.",
  destinationIntent: "help-me-choose",
  destinationQuery: "",
  destinationPlaceId: undefined,
  budgetBand: "comfort",
  splurgeTolerance: 60,
  pace: "balanced",
  interests: ["food", "culture", "hidden gems"],
  constraintsNotes: "Vegetarian-friendly dinners, walkable neighborhoods, no forced resort vibe.",
  lodgingStyle: "boutique hotel",
  neighborhoodVibe: "walkable and local",
  mustHaves: "Excellent coffee, one memorable dinner, room for wandering.",
  hardNos: "Tour buses, loud club districts, long transfers every day.",
  loyaltyPrograms: "None",
  surpriseTolerance: "balanced",
};

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
}

function datesValid(startDate: string, endDate: string) {
  return startDate !== "" && endDate !== "" && endDate >= startDate;
}

const slideVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 200 : -200, opacity: 0, scale: 0.97 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? -200 : 200, opacity: 0, scale: 0.97 }),
};

const inputClasses = "w-full px-3 py-2.5 rounded-xl bg-warm-50 border border-warm-100 text-warm-900 text-sm focus:outline-none focus:border-coral focus:ring-1 focus:ring-coral/30";
const labelClasses = "block text-xs font-semibold uppercase tracking-widest text-warm-600 mb-2";

function activePill(isActive: boolean) {
  return isActive
    ? "bg-coral text-white"
    : "bg-warm-50 text-warm-600 border border-warm-100 hover:border-warm-400";
}

export function PlannerShell() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [form, setForm] = useState<FormState>(initialState);
  const [destinationSuggestions, setDestinationSuggestions] = useState<DestinationSuggestion[]>([]);
  const [autocompleteLive, setAutocompleteLive] = useState(false);
  const [autocompleteReason, setAutocompleteReason] = useState<string | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [isAutocompletePending, setIsAutocompletePending] = useState(false);
  const [autocompleteSessionToken, setAutocompleteSessionToken] = useState(() => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }

    return `session-${Math.random().toString(36).slice(2)}`;
  });
  const [error, setError] = useState<string | null>(null);
  const [savedTrips, setSavedTrips] = useState<SavedTripSnapshot[]>([]);
  const [isPending, startTransition] = useTransition();
  const deferredDestinationQuery = useDeferredValue(form.destinationQuery);
  const shortlistEntries = useMemo(
    () => form.destinationIntent === "shortlist"
      ? form.destinationQuery.split(",").map((item) => item.trim()).filter(Boolean)
      : [],
    [form.destinationIntent, form.destinationQuery],
  );

  const destinationHint = useMemo(() => {
    if (form.destinationIntent === "fixed") return "Enter a city or region you already want.";
    if (form.destinationIntent === "shortlist") return "List a few options, separated by commas.";
    return "Leave blank if you want the planner to choose from your taste profile.";
  }, [form.destinationIntent]);

  const autocompleteEnabled = form.destinationIntent !== "help-me-choose" && !deferredDestinationQuery.includes(",");
  const destinationPreviewQuery = form.destinationQuery.trim();

  const canContinue = useMemo(() => {
    if (stepIndex === 0) return Boolean(form.provider && form.tripType);
    if (stepIndex === 1) return datesValid(form.startDate, form.endDate) && Boolean(form.destinationIntent);
    if (stepIndex === 2) return form.interests.length > 0;
    return true;
  }, [form, stepIndex]);

  const totalSteps = onboardingSteps.length;

  function buildPayload(): TripRequest {
    const shortlist = form.destinationIntent === "shortlist"
      ? form.destinationQuery.split(",").map((item) => item.trim()).filter(Boolean)
      : [];
    return {
      provider: form.provider,
      travelerProfile: {
        tripType: form.tripType, startDate: form.startDate, endDate: form.endDate,
        dateFlexibility: form.dateFlexibility, destinationIntent: form.destinationIntent,
        destinationQuery: form.destinationQuery, budgetBand: form.budgetBand,
        splurgeTolerance: form.splurgeTolerance, pace: form.pace, interests: form.interests,
        constraints: form.constraintsNotes.split(",").map((i) => i.trim()).filter(Boolean),
        constraintsNotes: form.constraintsNotes, lodgingStyle: form.lodgingStyle,
        neighborhoodVibe: form.neighborhoodVibe, mustHaves: form.mustHaves,
        hardNos: form.hardNos, loyaltyPrograms: form.loyaltyPrograms,
        surpriseTolerance: form.surpriseTolerance,
      },
      destinationContext: {
        destinationQuery: form.destinationQuery,
        shortlist,
        selectedPlaceId: form.destinationPlaceId,
        selectedPlaceLabel: form.destinationQuery || undefined,
      },
      constraints: form.constraintsNotes.split(",").map((i) => i.trim()).filter(Boolean),
      createdAt: new Date().toISOString(),
    };
  }

  useEffect(() => {
    setSavedTrips(getSavedTrips());
  }, []);

  useEffect(() => {
    if (!autocompleteEnabled) {
      setDestinationSuggestions([]);
      setSuggestionsOpen(false);
      return;
    }

    const trimmed = deferredDestinationQuery.trim();

    if (trimmed.length < 2) {
      setDestinationSuggestions([]);
      setSuggestionsOpen(false);
      setAutocompleteReason(null);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsAutocompletePending(true);

      try {
        const params = new URLSearchParams({
          input: trimmed,
          sessionToken: autocompleteSessionToken,
        });
        const response = await fetch(`/api/places/autocomplete?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const data = await response.json() as AutocompleteResponse;

        if (!response.ok) {
          throw new Error(data.reason ?? "Autocomplete request failed.");
        }

        setDestinationSuggestions(data.suggestions);
        setAutocompleteLive(data.live);
        setAutocompleteReason(data.reason);
        setSuggestionsOpen(data.suggestions.length > 0);
      } catch (autocompleteError) {
        if (controller.signal.aborted) {
          return;
        }

        setDestinationSuggestions([]);
        setAutocompleteLive(false);
        setAutocompleteReason(autocompleteError instanceof Error ? autocompleteError.message : "Autocomplete request failed.");
        setSuggestionsOpen(false);
      } finally {
        if (!controller.signal.aborted) {
          setIsAutocompletePending(false);
        }
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [autocompleteEnabled, autocompleteSessionToken, deferredDestinationQuery]);

  function selectDestinationSuggestion(suggestion: DestinationSuggestion) {
    setForm((current) => ({
      ...current,
      destinationQuery: suggestion.text,
      destinationPlaceId: suggestion.placeId,
    }));
    setDestinationSuggestions([]);
    setSuggestionsOpen(false);
    setAutocompleteReason(null);
    setAutocompleteSessionToken(typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `session-${Math.random().toString(36).slice(2)}`);
  }

  function nextStep() { setDirection(1); setStepIndex((c) => Math.min(c + 1, totalSteps - 1)); }
  function previousStep() { setDirection(-1); setStepIndex((c) => Math.max(c - 1, 0)); }

  function submitPlan() {
    setError(null);
    const payload = buildPayload();
    startTransition(async () => {
      try {
        const response = await fetch("/api/trips", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error("Planner request failed.");
        const data = (await response.json()) as { tripId: string };
        router.push(`/trip/${data.tripId}`);
      } catch (submissionError) {
        setError(submissionError instanceof Error ? submissionError.message : "Unable to generate trip.");
      }
    });
  }

  function handleDateChange(field: "startDate" | "endDate", value: string) {
    setForm((c) => ({ ...c, [field]: value }));
  }

  return (
    <div className="w-full max-w-lg">
      {savedTrips.length > 0 && (
        <div className="mb-5 rounded-2xl border border-warm-600 bg-warm-800/70 p-4 text-white shadow-[0_18px_50px_rgba(26,22,20,0.18)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-coral-light">Saved in this browser</p>
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
                  <p className="truncate text-sm font-semibold text-white">{trip.plan.destinationSummary.title}</p>
                  <p className="mt-1 truncate text-xs text-white/60">
                    {trip.request.travelerProfile.startDate} to {trip.request.travelerProfile.endDate} · {trip.request.travelerProfile.budgetBand}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-coral-light">Open</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Progress */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-xs font-semibold text-coral-light">Step {stepIndex + 1} of {totalSteps}</span>
        <div className="flex-1 h-1 bg-warm-600 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-coral to-coral-light rounded-full transition-all duration-300" style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }} />
        </div>
      </div>

      {/* Stacked Card Container */}
      <div className="relative">
        <div className="hidden md:block absolute top-3 left-4 right-4 h-full bg-warm-600 rounded-2xl opacity-30" />
        <div className="hidden md:block absolute top-1.5 left-2 right-2 h-full bg-warm-600 rounded-2xl opacity-50" />

        <div className="relative bg-cream rounded-2xl shadow-xl p-6 md:p-8 min-h-[420px] flex flex-col">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div key={stepIndex} custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: "easeInOut" }} className="flex-1">
              <div className="mb-6">
                <div className="text-2xl mb-1">{stepEmojis[stepIndex]}</div>
                <h2 className="text-xl font-extrabold text-warm-900 mb-1">{onboardingSteps[stepIndex].title}</h2>
                <p className="text-sm text-warm-400">{onboardingSteps[stepIndex].description}</p>
              </div>

              {/* Step 0: Provider & Trip Type */}
              {stepIndex === 0 && (
                <div className="space-y-5">
                  <div>
                    <label className={labelClasses}>Model provider</label>
                    <div className="grid grid-cols-2 gap-3">
                      {(["openai", "claude"] as const).map((provider) => (
                        <button key={provider} type="button" onClick={() => setForm((c) => ({ ...c, provider }))}
                          className={`text-left p-3 rounded-xl border-2 transition-all ${provider === form.provider ? "border-coral bg-coral-wash" : "border-warm-100 bg-warm-50 hover:border-warm-400"}`}>
                          <div className="font-semibold text-warm-900 text-sm">{provider === "openai" ? "OpenAI" : "Claude"}</div>
                          <div className="text-xs text-warm-400 mt-0.5">{providerCopy[provider]}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={labelClasses}>Trip type</label>
                    <div className="flex flex-wrap gap-2">
                      {(["solo", "couple", "family", "friends", "work", "mixed"] as const).map((tripType) => (
                        <button key={tripType} type="button" onClick={() => setForm((c) => ({ ...c, tripType }))}
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${activePill(tripType === form.tripType)}`}>
                          {tripType}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 1: Dates & Destination */}
              {stepIndex === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="startDate" className={labelClasses}>Start date</label>
                      <input id="startDate" type="date" value={form.startDate} onChange={(e) => handleDateChange("startDate", e.target.value)} className={inputClasses} />
                    </div>
                    <div>
                      <label htmlFor="endDate" className={labelClasses}>End date</label>
                      <input id="endDate" type="date" value={form.endDate} min={form.startDate || undefined} onChange={(e) => handleDateChange("endDate", e.target.value)} className={inputClasses} />
                    </div>
                  </div>
                  {form.startDate && form.endDate && form.endDate < form.startDate && (
                    <p className="text-red-500 text-xs mt-1">End date must be on or after start date.</p>
                  )}
                  <div>
                    <label htmlFor="dateFlexibility" className={labelClasses}>Date flexibility</label>
                    <textarea id="dateFlexibility" rows={2} value={form.dateFlexibility} onChange={(e) => setForm((c) => ({ ...c, dateFlexibility: e.target.value }))} className={`${inputClasses} resize-none`} />
                  </div>
                  <div>
                    <label className={labelClasses}>Destination intent</label>
                    <div className="flex flex-wrap gap-2">
                      {([["fixed", "I already know"], ["shortlist", "I have a shortlist"], ["help-me-choose", "Help me choose"]] as const).map(([value, label]) => (
                        <button key={value} type="button" onClick={() => setForm((c) => ({ ...c, destinationIntent: value }))}
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${activePill(value === form.destinationIntent)}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
                    <div className="relative">
                      <label htmlFor="destinationQuery" className={labelClasses}>Destination notes</label>
                      <div className="rounded-[1.4rem] border border-warm-100 bg-white/90 p-2 shadow-[0_24px_60px_rgba(61,54,50,0.08)]">
                        <div className="rounded-[1.1rem] bg-gradient-to-r from-coral-wash via-white to-warm-50 px-3 py-3">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                            <div className="flex min-w-0 flex-1 items-start gap-3">
                              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-warm-900 text-sm text-white shadow-[0_10px_25px_rgba(26,22,20,0.22)]">
                                ⌘
                              </div>
                              <div className="min-w-0 flex-1">
                                <input
                                  id="destinationQuery"
                                  placeholder={form.destinationIntent === "shortlist" ? "Lisbon, Mexico City, Kyoto" : "Lisbon"}
                                  value={form.destinationQuery}
                                  onChange={(e) => setForm((current) => ({ ...current, destinationQuery: e.target.value, destinationPlaceId: undefined }))}
                                  onFocus={() => setSuggestionsOpen(destinationSuggestions.length > 0)}
                                  autoComplete="off"
                                  className="w-full bg-transparent text-sm font-semibold text-warm-900 placeholder:text-warm-400 focus:outline-none"
                                />
                                <p className="mt-1 text-[11px] text-warm-400">{destinationHint}</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-3 border-t border-warm-100/80 pt-2 sm:block sm:border-t-0 sm:pt-0 sm:text-right">
                              <div className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${autocompleteLive ? "text-coral" : "text-warm-400"}`}>
                                {autocompleteLive ? "Live search" : "Planner input"}
                              </div>
                              <div className="text-[10px] text-warm-400">
                                {isAutocompletePending ? "Searching..." : form.destinationIntent === "help-me-choose" ? "Optional" : "Google Places"}
                              </div>
                            </div>
                          </div>

                          {shortlistEntries.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2 border-t border-warm-100/80 pt-3">
                              {shortlistEntries.map((entry) => (
                                <span
                                  key={entry}
                                  className="rounded-full border border-coral/20 bg-white px-3 py-1 text-xs font-medium text-warm-600"
                                >
                                  {entry}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {suggestionsOpen && destinationSuggestions.length > 0 && (
                        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-[1.25rem] border border-warm-100 bg-cream shadow-[0_26px_70px_rgba(26,22,20,0.14)]">
                          {destinationSuggestions.map((suggestion) => (
                            <button
                              key={suggestion.placeId}
                              type="button"
                              onClick={() => selectDestinationSuggestion(suggestion)}
                              className="flex w-full items-start gap-3 border-b border-warm-100/80 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-coral-wash"
                            >
                              <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-warm-900 text-xs text-white">
                                ✦
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold text-warm-900">{suggestion.mainText}</div>
                                <div className="truncate text-xs text-warm-400">{suggestion.secondaryText || suggestion.text}</div>
                              </div>
                              <div className="text-[10px] uppercase tracking-[0.16em] text-coral">
                                {suggestion.types[0]?.replaceAll("_", " ") ?? "place"}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {autocompleteReason && (
                        <p className="mt-2 text-[11px] text-warm-400">{autocompleteReason}</p>
                      )}
                    </div>

                    <div className="rounded-[1.6rem] border border-warm-100 bg-gradient-to-br from-warm-900 via-warm-600 to-coral-deep p-[1px] shadow-[0_28px_90px_rgba(26,22,20,0.18)]">
                      <div className="h-full rounded-[calc(1.6rem-1px)] bg-cream/95 p-3">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-coral">Atlas Lens</p>
                            <h3 className="mt-1 text-sm font-bold text-warm-900">
                              {destinationPreviewQuery || "Destination map preview"}
                            </h3>
                          </div>
                          <div className="rounded-full bg-coral-wash px-2.5 py-1 text-[10px] font-semibold text-coral">
                            {form.destinationPlaceId ? "Pinned" : "Search-led"}
                          </div>
                        </div>
                        <div className="overflow-hidden rounded-[1.2rem] border border-warm-100 bg-warm-50">
                          {destinationPreviewQuery ? (
                            <GoogleMapFrame
                              query={destinationPreviewQuery}
                              placeId={form.destinationPlaceId}
                              title="Destination preview map"
                              className="h-56 w-full rounded-[1.2rem]"
                            />
                          ) : (
                            <div className="grid h-56 place-items-center bg-[radial-gradient(circle_at_top,_rgba(255,107,66,0.18),_transparent_45%),linear-gradient(135deg,_#f5f1ee,_#fff5f0)] px-6 text-center">
                              <div>
                                <p className="text-sm font-semibold text-warm-900">Search a city to preview it on the map.</p>
                                <p className="mt-1 text-xs text-warm-400">The planner uses this surface for fixed destinations and shortlist exploration.</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Budget, Pace, Interests */}
              {stepIndex === 2 && (
                <div className="space-y-5">
                  <div>
                    <label className={labelClasses}>Budget</label>
                    <div className="grid grid-cols-3 gap-3">
                      {budgetOptions.map((opt) => (
                        <button key={opt.value} type="button" onClick={() => setForm((c) => ({ ...c, budgetBand: opt.value }))}
                          className={`p-3 rounded-xl border-2 text-center transition-all ${opt.value === form.budgetBand ? "border-coral bg-coral-wash" : "border-warm-100 hover:border-warm-400"}`}>
                          <div className="text-xl">{opt.icon}</div>
                          <div className={`text-xs font-semibold mt-1 ${opt.value === form.budgetBand ? "text-coral" : "text-warm-600"}`}>{opt.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="splurgeTolerance" className={labelClasses}>Splurge tolerance</label>
                    <input id="splurgeTolerance" max={100} min={0} type="range" value={form.splurgeTolerance}
                      onChange={(e) => setForm((c) => ({ ...c, splurgeTolerance: Number(e.target.value) }))} className="w-full accent-coral" />
                    <p className="text-xs text-warm-400 mt-1">{form.splurgeTolerance}% willing to splurge for one standout experience.</p>
                  </div>
                  <div>
                    <label className={labelClasses}>Trip pace</label>
                    <div className="flex gap-2">
                      {(["relaxed", "balanced", "packed"] as const).map((pace) => (
                        <button key={pace} type="button" onClick={() => setForm((c) => ({ ...c, pace }))}
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${activePill(pace === form.pace)}`}>
                          {pace}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={labelClasses}>Interests</label>
                    <div className="flex flex-wrap gap-2">
                      {interestOptions.map((interest) => (
                        <button key={interest.value} type="button" onClick={() => setForm((c) => ({ ...c, interests: toggleValue(c.interests, interest.value) }))}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${activePill(form.interests.includes(interest.value))}`}>
                          {interest.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Constraints */}
              {stepIndex === 3 && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="constraints" className={labelClasses}>Constraints and accessibility notes</label>
                    <textarea id="constraints" rows={4} value={form.constraintsNotes} onChange={(e) => setForm((c) => ({ ...c, constraintsNotes: e.target.value }))} className={`${inputClasses} resize-none`} />
                  </div>
                  <div>
                    <label htmlFor="mustHaves" className={labelClasses}>Must-haves</label>
                    <textarea id="mustHaves" rows={2} value={form.mustHaves} onChange={(e) => setForm((c) => ({ ...c, mustHaves: e.target.value }))} className={`${inputClasses} resize-none`} />
                  </div>
                  <div>
                    <label htmlFor="hardNos" className={labelClasses}>Hard no</label>
                    <textarea id="hardNos" rows={2} value={form.hardNos} onChange={(e) => setForm((c) => ({ ...c, hardNos: e.target.value }))} className={`${inputClasses} resize-none`} />
                  </div>
                </div>
              )}

              {/* Step 4: Lodging & Vibe */}
              {stepIndex === 4 && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="lodgingStyle" className={labelClasses}>Lodging style</label>
                    <input id="lodgingStyle" value={form.lodgingStyle} onChange={(e) => setForm((c) => ({ ...c, lodgingStyle: e.target.value }))} className={inputClasses} />
                  </div>
                  <div>
                    <label htmlFor="neighborhoodVibe" className={labelClasses}>Neighborhood vibe</label>
                    <input id="neighborhoodVibe" value={form.neighborhoodVibe} onChange={(e) => setForm((c) => ({ ...c, neighborhoodVibe: e.target.value }))} className={inputClasses} />
                  </div>
                  <div>
                    <label htmlFor="loyaltyPrograms" className={labelClasses}>Loyalty programs</label>
                    <input id="loyaltyPrograms" value={form.loyaltyPrograms} onChange={(e) => setForm((c) => ({ ...c, loyaltyPrograms: e.target.value }))} className={inputClasses} />
                  </div>
                  <div>
                    <label className={labelClasses}>Surprise tolerance</label>
                    <div className="flex gap-2">
                      {([["classic", "Safe and classic"], ["balanced", "Balanced"], ["explorer", "Surprise me"]] as const).map(([value, label]) => (
                        <button key={value} type="button" onClick={() => setForm((c) => ({ ...c, surpriseTolerance: value }))}
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${activePill(value === form.surpriseTolerance)}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 5: Profile Summary */}
              {stepIndex === 5 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-warm-50 rounded-xl p-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-warm-400 mb-2">Profile snapshot</p>
                    <p className="font-bold text-warm-900 text-sm">{form.tripType} trip / {form.budgetBand}</p>
                    <p className="text-sm text-warm-400 mt-1">{form.startDate} to {form.endDate}</p>
                    <p className="text-sm text-warm-400 mt-1">{form.destinationIntent === "help-me-choose" ? "Planner-led destination selection" : form.destinationQuery || "Destination to be clarified"}</p>
                  </div>
                  <div className="bg-warm-50 rounded-xl p-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-warm-400 mb-2">Taste profile</p>
                    <div className="flex flex-wrap gap-2">
                      {form.interests.map((interest) => (
                        <span key={interest} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-warm-600">
                          {interest}
                        </span>
                      ))}
                    </div>
                    <p className="text-sm text-warm-400 mt-1">{form.neighborhoodVibe}</p>
                    <p className="text-sm text-warm-400 mt-1">{form.lodgingStyle}</p>
                  </div>
                  <div className="bg-warm-50 rounded-xl p-4 md:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-widest text-warm-400 mb-2">Constraints</p>
                    <div className="flex flex-wrap gap-2">
                      {form.constraintsNotes.split(",").map((item) => item.trim()).filter(Boolean).map((item) => (
                        <span key={item} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-warm-600">
                          {item}
                        </span>
                      ))}
                    </div>
                    <p className="text-sm text-warm-400 mt-2"><strong className="text-warm-600">Must-haves:</strong> {form.mustHaves}</p>
                    <p className="text-sm text-warm-400 mt-1"><strong className="text-warm-600">Hard no:</strong> {form.hardNos}</p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {error && <p className="text-red-600 text-sm mt-4">{error}</p>}

          <div className="flex gap-3 mt-6 pt-4 border-t border-warm-100">
            <button type="button" disabled={stepIndex === 0 || isPending} onClick={previousStep}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-warm-400 hover:text-warm-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              ← Back
            </button>
            {stepIndex < totalSteps - 1 ? (
              <button type="button" disabled={!canContinue || isPending} onClick={nextStep}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-coral text-white hover:bg-coral-deep disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                Continue →
              </button>
            ) : (
              <button type="button" disabled={isPending} onClick={submitPlan}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-coral text-white hover:bg-coral-deep disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {isPending ? "Generating itinerary..." : "Generate trip →"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

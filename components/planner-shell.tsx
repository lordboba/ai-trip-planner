"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { onboardingSteps } from "@/lib/onboarding";
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

const initialState: FormState = {
  provider: "openai",
  tripType: "couple",
  startDate: "2026-06-14",
  endDate: "2026-06-18",
  dateFlexibility: "Weekend in June works too.",
  destinationIntent: "help-me-choose",
  destinationQuery: "",
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
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const destinationHint = useMemo(() => {
    if (form.destinationIntent === "fixed") return "Enter a city or region you already want.";
    if (form.destinationIntent === "shortlist") return "List a few options, separated by commas.";
    return "Leave blank if you want the planner to choose from your taste profile.";
  }, [form.destinationIntent]);

  const canContinue = useMemo(() => {
    if (stepIndex === 0) return Boolean(form.provider && form.tripType);
    if (stepIndex === 1) return Boolean(form.startDate && form.endDate && form.destinationIntent);
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
      destinationContext: { destinationQuery: form.destinationQuery, shortlist },
      constraints: form.constraintsNotes.split(",").map((i) => i.trim()).filter(Boolean),
      createdAt: new Date().toISOString(),
    };
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

  return (
    <div className="w-full max-w-lg">
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
                      <input id="startDate" type="date" value={form.startDate} onChange={(e) => setForm((c) => ({ ...c, startDate: e.target.value }))} className={inputClasses} />
                    </div>
                    <div>
                      <label htmlFor="endDate" className={labelClasses}>End date</label>
                      <input id="endDate" type="date" value={form.endDate} onChange={(e) => setForm((c) => ({ ...c, endDate: e.target.value }))} className={inputClasses} />
                    </div>
                  </div>
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
                  <div>
                    <label htmlFor="destinationQuery" className={labelClasses}>Destination notes</label>
                    <input id="destinationQuery" placeholder={form.destinationIntent === "shortlist" ? "Lisbon, Mexico City, Kyoto" : "Lisbon"} value={form.destinationQuery}
                      onChange={(e) => setForm((c) => ({ ...c, destinationQuery: e.target.value }))} className={`${inputClasses} placeholder:text-warm-400`} />
                    <p className="text-xs text-warm-400 mt-1.5">{destinationHint}</p>
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
                    <p className="text-sm text-warm-600">{form.interests.join(", ")}</p>
                    <p className="text-sm text-warm-400 mt-1">{form.neighborhoodVibe}</p>
                    <p className="text-sm text-warm-400 mt-1">{form.lodgingStyle}</p>
                  </div>
                  <div className="bg-warm-50 rounded-xl p-4 md:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-widest text-warm-400 mb-2">Constraints</p>
                    <p className="text-sm text-warm-600">{form.constraintsNotes}</p>
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

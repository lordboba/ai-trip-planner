"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { onboardingSteps } from "@/lib/onboarding";
import type { BudgetBand, DestinationIntent, LLMProvider, Pace, SurpriseTolerance, TripRequest, TripType } from "@/lib/types";

const interestOptions = [
  "food",
  "nightlife",
  "nature",
  "culture",
  "shopping",
  "wellness",
  "adventure",
  "family-friendly",
  "hidden gems",
];

const providerCopy: Record<LLMProvider, string> = {
  openai: "Faster itinerary drafting and tool-first orchestration.",
  claude: "Strong long-form reasoning for taste and trip narrative.",
};

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

export function PlannerShell() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
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
        tripType: form.tripType,
        startDate: form.startDate,
        endDate: form.endDate,
        dateFlexibility: form.dateFlexibility,
        destinationIntent: form.destinationIntent,
        destinationQuery: form.destinationQuery,
        budgetBand: form.budgetBand,
        splurgeTolerance: form.splurgeTolerance,
        pace: form.pace,
        interests: form.interests,
        constraints: form.constraintsNotes
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        constraintsNotes: form.constraintsNotes,
        lodgingStyle: form.lodgingStyle,
        neighborhoodVibe: form.neighborhoodVibe,
        mustHaves: form.mustHaves,
        hardNos: form.hardNos,
        loyaltyPrograms: form.loyaltyPrograms,
        surpriseTolerance: form.surpriseTolerance,
      },
      destinationContext: {
        destinationQuery: form.destinationQuery,
        shortlist,
      },
      constraints: form.constraintsNotes
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      createdAt: new Date().toISOString(),
    };
  }

  function nextStep() {
    setStepIndex((current) => Math.min(current + 1, totalSteps - 1));
  }

  function previousStep() {
    setStepIndex((current) => Math.max(current - 1, 0));
  }

  function submitPlan() {
    setError(null);
    const payload = buildPayload();

    startTransition(async () => {
      try {
        const response = await fetch("/api/trips", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error("Planner request failed.");
        }

        const data = (await response.json()) as { tripId: string };
        router.push(`/trip/${data.tripId}`);
      } catch (submissionError) {
        setError(submissionError instanceof Error ? submissionError.message : "Unable to generate trip.");
      }
    });
  }

  return (
    <main className="planner-page">
      <aside className="planner-rail">
        <p className="eyebrow">Phase one / website</p>
        <h1>Build the traveler profile before the agents move.</h1>
        <p className="rail-copy">
          This is intentionally longer than a casual travel search. The better the intake, the better the itinerary.
        </p>
        <div className="step-list">
          {onboardingSteps.map((step, index) => (
            <div className={`step-chip ${index === stepIndex ? "active" : ""}`} key={step.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <strong>{step.title}</strong>
                <p>{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <section className="planner-panel">
        <div className="planner-panel-top">
          <div>
            <p className="eyebrow">Step {stepIndex + 1} of {totalSteps}</p>
            <h2>{onboardingSteps[stepIndex].title}</h2>
            <p>{onboardingSteps[stepIndex].description}</p>
          </div>
          <div className="progress-meter">
            <span style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }} />
          </div>
        </div>

        <div className="planner-card">
          {stepIndex === 0 && (
            <div className="form-grid two-column-grid">
              <div>
                <label>Model provider</label>
                <div className="segmented-row">
                  {(["openai", "claude"] as const).map((provider) => (
                    <button
                      className={provider === form.provider ? "segment active" : "segment"}
                      key={provider}
                      onClick={() => setForm((current) => ({ ...current, provider }))}
                      type="button"
                    >
                      <strong>{provider === "openai" ? "OpenAI" : "Claude"}</strong>
                      <span>{providerCopy[provider]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label>Trip type</label>
                <div className="pill-row">
                  {(["solo", "couple", "family", "friends", "work", "mixed"] as const).map((tripType) => (
                    <button
                      className={tripType === form.tripType ? "pill active" : "pill"}
                      key={tripType}
                      onClick={() => setForm((current) => ({ ...current, tripType }))}
                      type="button"
                    >
                      {tripType}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {stepIndex === 1 && (
            <div className="form-grid">
              <div className="two-column-grid">
                <div>
                  <label htmlFor="startDate">Start date</label>
                  <input id="startDate" type="date" value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} />
                </div>
                <div>
                  <label htmlFor="endDate">End date</label>
                  <input id="endDate" type="date" value={form.endDate} onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))} />
                </div>
              </div>
              <div>
                <label htmlFor="dateFlexibility">Date flexibility</label>
                <textarea id="dateFlexibility" rows={2} value={form.dateFlexibility} onChange={(event) => setForm((current) => ({ ...current, dateFlexibility: event.target.value }))} />
              </div>
              <div>
                <label>Destination intent</label>
                <div className="pill-row">
                  {([
                    ["fixed", "I already know"],
                    ["shortlist", "I have a shortlist"],
                    ["help-me-choose", "Help me choose"],
                  ] as const).map(([value, label]) => (
                    <button
                      className={value === form.destinationIntent ? "pill active" : "pill"}
                      key={value}
                      onClick={() => setForm((current) => ({ ...current, destinationIntent: value }))}
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="destinationQuery">Destination notes</label>
                <input
                  id="destinationQuery"
                  placeholder={form.destinationIntent === "shortlist" ? "Lisbon, Mexico City, Kyoto" : "Lisbon"}
                  value={form.destinationQuery}
                  onChange={(event) => setForm((current) => ({ ...current, destinationQuery: event.target.value }))}
                />
                <small>{destinationHint}</small>
              </div>
            </div>
          )}

          {stepIndex === 2 && (
            <div className="form-grid">
              <div>
                <label>Budget band</label>
                <div className="pill-row">
                  {(["lean", "comfort", "luxury"] as const).map((budgetBand) => (
                    <button
                      className={budgetBand === form.budgetBand ? "pill active" : "pill"}
                      key={budgetBand}
                      onClick={() => setForm((current) => ({ ...current, budgetBand }))}
                      type="button"
                    >
                      {budgetBand}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="splurgeTolerance">Splurge tolerance</label>
                <input
                  id="splurgeTolerance"
                  max={100}
                  min={0}
                  type="range"
                  value={form.splurgeTolerance}
                  onChange={(event) => setForm((current) => ({ ...current, splurgeTolerance: Number(event.target.value) }))}
                />
                <small>{form.splurgeTolerance}% willing to splurge for one standout experience.</small>
              </div>
              <div>
                <label>Trip pace</label>
                <div className="pill-row">
                  {(["relaxed", "balanced", "packed"] as const).map((pace) => (
                    <button
                      className={pace === form.pace ? "pill active" : "pill"}
                      key={pace}
                      onClick={() => setForm((current) => ({ ...current, pace }))}
                      type="button"
                    >
                      {pace}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label>Interests</label>
                <div className="pill-row interest-grid">
                  {interestOptions.map((interest) => (
                    <button
                      className={form.interests.includes(interest) ? "pill active" : "pill"}
                      key={interest}
                      onClick={() => setForm((current) => ({ ...current, interests: toggleValue(current.interests, interest) }))}
                      type="button"
                    >
                      {interest}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {stepIndex === 3 && (
            <div className="form-grid two-column-grid">
              <div>
                <label htmlFor="constraints">Constraints and accessibility notes</label>
                <textarea id="constraints" rows={6} value={form.constraintsNotes} onChange={(event) => setForm((current) => ({ ...current, constraintsNotes: event.target.value }))} />
              </div>
              <div>
                <label htmlFor="mustHaves">Must-haves</label>
                <textarea id="mustHaves" rows={3} value={form.mustHaves} onChange={(event) => setForm((current) => ({ ...current, mustHaves: event.target.value }))} />
                <label htmlFor="hardNos">Hard no</label>
                <textarea id="hardNos" rows={3} value={form.hardNos} onChange={(event) => setForm((current) => ({ ...current, hardNos: event.target.value }))} />
              </div>
            </div>
          )}

          {stepIndex === 4 && (
            <div className="form-grid two-column-grid">
              <div>
                <label htmlFor="lodgingStyle">Lodging style</label>
                <input id="lodgingStyle" value={form.lodgingStyle} onChange={(event) => setForm((current) => ({ ...current, lodgingStyle: event.target.value }))} />
              </div>
              <div>
                <label htmlFor="neighborhoodVibe">Neighborhood vibe</label>
                <input id="neighborhoodVibe" value={form.neighborhoodVibe} onChange={(event) => setForm((current) => ({ ...current, neighborhoodVibe: event.target.value }))} />
              </div>
              <div>
                <label htmlFor="loyaltyPrograms">Loyalty programs</label>
                <input id="loyaltyPrograms" value={form.loyaltyPrograms} onChange={(event) => setForm((current) => ({ ...current, loyaltyPrograms: event.target.value }))} />
              </div>
              <div>
                <label>Surprise tolerance</label>
                <div className="pill-row">
                  {([
                    ["classic", "Safe and classic"],
                    ["balanced", "Balanced"],
                    ["explorer", "Surprise me"],
                  ] as const).map(([value, label]) => (
                    <button
                      className={value === form.surpriseTolerance ? "pill active" : "pill"}
                      key={value}
                      onClick={() => setForm((current) => ({ ...current, surpriseTolerance: value }))}
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {stepIndex === 5 && (
            <div className="summary-grid">
              <div className="summary-card">
                <p className="card-kicker">Profile snapshot</p>
                <h3>{form.tripType} trip / {form.budgetBand}</h3>
                <p>{form.startDate} to {form.endDate}</p>
                <p>{form.destinationIntent === "help-me-choose" ? "Planner-led destination selection" : form.destinationQuery || "Destination to be clarified"}</p>
              </div>
              <div className="summary-card">
                <p className="card-kicker">Taste profile</p>
                <p>{form.interests.join(", ")}</p>
                <p>{form.neighborhoodVibe}</p>
                <p>{form.lodgingStyle}</p>
              </div>
              <div className="summary-card full-span">
                <p className="card-kicker">Constraints and planner notes</p>
                <p>{form.constraintsNotes}</p>
                <p><strong>Must-haves:</strong> {form.mustHaves}</p>
                <p><strong>Hard no:</strong> {form.hardNos}</p>
              </div>
            </div>
          )}
        </div>

        {error ? <p className="error-line">{error}</p> : null}

        <div className="planner-actions">
          <button className="secondary-button" disabled={stepIndex === 0 || isPending} onClick={previousStep} type="button">
            Back
          </button>
          {stepIndex < totalSteps - 1 ? (
            <button className="primary-button" disabled={!canContinue || isPending} onClick={nextStep} type="button">
              Continue
            </button>
          ) : (
            <button className="primary-button" disabled={isPending} onClick={submitPlan} type="button">
              {isPending ? "Generating itinerary..." : "Generate trip"}
            </button>
          )}
        </div>
      </section>
    </main>
  );
}

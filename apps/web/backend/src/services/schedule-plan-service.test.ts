import test from "node:test";
import assert from "node:assert/strict";
import type { SchedulePlanRequest } from "../domain/schedule-plans.ts";
import { adjustSelectionsForBudget, createSchedulePlan } from "./schedule-plan-service.ts";

function sampleRequest(): SchedulePlanRequest {
  return {
    importedSchedule: {
      source: "ics",
      importedAt: "2026-04-01T00:00:00.000Z",
      timezone: "America/Los_Angeles",
      cityInference: {
        city: "Lisbon",
        region: "Lisbon",
        country: "Portugal",
        confidence: 0.92,
        matchedFrom: ["calendar locations"],
      },
      warnings: [],
      events: [
        {
          id: "evt-1",
          source: "ics",
          title: "Team sync",
          description: "",
          location: "Office",
          startsAt: "2026-04-10T16:00:00.000Z",
          endsAt: "2026-04-10T17:00:00.000Z",
          isAllDay: false,
          timezone: "America/Los_Angeles",
          type: "meeting",
          inferredCity: "Lisbon",
          locked: true,
        },
        {
          id: "evt-2",
          source: "ics",
          title: "Client lunch",
          description: "",
          location: "Downtown",
          startsAt: "2026-04-10T19:00:00.000Z",
          endsAt: "2026-04-10T20:00:00.000Z",
          isAllDay: false,
          timezone: "America/Los_Angeles",
          type: "meeting",
          inferredCity: "Lisbon",
          locked: true,
        },
        {
          id: "evt-3",
          source: "ics",
          title: "Working session",
          description: "",
          location: "Hotel lobby",
          startsAt: "2026-04-10T21:00:00.000Z",
          endsAt: "2026-04-10T21:30:00.000Z",
          isAllDay: false,
          timezone: "America/Los_Angeles",
          type: "focus",
          inferredCity: "Lisbon",
          locked: true,
        },
        {
          id: "evt-4",
          source: "ics",
          title: "Dinner reservation",
          description: "",
          location: "Neighborhood",
          startsAt: "2026-04-10T22:00:00.000Z",
          endsAt: "2026-04-10T23:00:00.000Z",
          isAllDay: false,
          timezone: "America/Los_Angeles",
          type: "meeting",
          inferredCity: "Lisbon",
          locked: true,
        },
      ],
    },
    preferences: {
      provider: "openai",
      budgetBand: "lean",
      interests: ["food", "culture", "hidden gems"],
      pace: "balanced",
      transport: "walk",
      earliestTime: "08:00",
      latestTime: "20:00",
      comments: "Prioritize good coffee and efficient meals.",
    },
    startDate: "2026-04-10",
    endDate: "2026-04-10",
  };
}

test("createSchedulePlan builds place-backed suggestions with workflow metadata", async () => {
  const previousPlacesKey = process.env.GOOGLE_PLACES_API_KEY;
  const previousOpenAIKey = process.env.OPENAI_API_KEY;
  const previousAnthropicKey = process.env.ANTHROPIC_API_KEY;

  delete process.env.GOOGLE_PLACES_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;

  try {
    const plan = await createSchedulePlan(sampleRequest());

    assert.equal(plan.slots.length, plan.suggestions.length);
    assert.ok(plan.slots.some((slot) => slot.kind === "meal-window"));
    assert.ok(plan.slots.some((slot) => slot.kind === "quick-stop"));
    assert.equal(plan.workflow.steps.length, 3);
    assert.equal(plan.generation.live, false);
    assert.ok(plan.suggestions.every((suggestion) => suggestion.place.source === "fallback"));
    assert.ok(plan.suggestions.every((suggestion) => suggestion.place.name.length > 0));
    assert.ok(plan.suggestions.every((suggestion) => suggestion.place.address?.startsWith("Near ")));
    assert.ok(plan.suggestions.every((suggestion) => suggestion.agentReason.length > 0));
    assert.ok(plan.suggestions.every((suggestion) => suggestion.budgetReason.length > 0));
    assert.ok(plan.suggestions.every((suggestion) => suggestion.transitNote.includes("minutes")));
  } finally {
    process.env.GOOGLE_PLACES_API_KEY = previousPlacesKey;
    process.env.OPENAI_API_KEY = previousOpenAIKey;
    process.env.ANTHROPIC_API_KEY = previousAnthropicKey;
  }
});

test("createSchedulePlan falls back when Google Places returns no candidates", async () => {
  const previousPlacesKey = process.env.GOOGLE_PLACES_API_KEY;
  const previousOpenAIKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;

  process.env.GOOGLE_PLACES_API_KEY = "test-key";
  delete process.env.OPENAI_API_KEY;
  globalThis.fetch = (async () => (
    new Response(JSON.stringify({ places: [] }), { status: 200 })
  )) as typeof fetch;

  try {
    const plan = await createSchedulePlan(sampleRequest());

    assert.ok(plan.suggestions.every((suggestion) => suggestion.place.source === "fallback"));
    assert.ok(plan.suggestions.every((suggestion) => suggestion.agentReason.includes("deterministic fallback candidates")));
  } finally {
    process.env.GOOGLE_PLACES_API_KEY = previousPlacesKey;
    process.env.OPENAI_API_KEY = previousOpenAIKey;
    globalThis.fetch = previousFetch;
  }
});

test("createSchedulePlan leaves visible commute buffer inside each suggestion window", async () => {
  const previousPlacesKey = process.env.GOOGLE_PLACES_API_KEY;
  const previousOpenAIKey = process.env.OPENAI_API_KEY;
  const previousAnthropicKey = process.env.ANTHROPIC_API_KEY;

  delete process.env.GOOGLE_PLACES_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;

  try {
    const request = sampleRequest();
    request.preferences.transport = "transit";
    const plan = await createSchedulePlan(request);

    for (const suggestion of plan.suggestions) {
      const slot = plan.slots.find((entry) => entry.id === suggestion.slotId);

      assert.ok(slot);
      assert.ok(Date.parse(suggestion.startsAt) >= Date.parse(slot.startsAt));
      assert.ok(Date.parse(suggestion.endsAt) <= Date.parse(slot.endsAt));
      assert.ok(suggestion.estimatedDurationMinutes < slot.durationMinutes);
      assert.match(suggestion.transitNote, /platform waits|traffic|transfers/i);
    }
  } finally {
    process.env.GOOGLE_PLACES_API_KEY = previousPlacesKey;
    process.env.OPENAI_API_KEY = previousOpenAIKey;
    process.env.ANTHROPIC_API_KEY = previousAnthropicKey;
  }
});

test("adjustSelectionsForBudget downgrades expensive picks when a cheaper fit exists", () => {
  const budget = adjustSelectionsForBudget({
    preferences: {
      provider: "openai",
      budgetBand: "lean",
      interests: ["food"],
      pace: "balanced",
      transport: "walk",
      earliestTime: "08:00",
      latestTime: "20:00",
      comments: "",
    },
    resolutions: [
      {
        context: {
          slot: {
            id: "slot-1",
            kind: "meal-window",
            label: "Meal window",
            startsAt: "2026-04-10T18:00:00.000Z",
            endsAt: "2026-04-10T19:00:00.000Z",
            durationMinutes: 60,
            city: "Lisbon",
            previousEventId: null,
            nextEventId: null,
          },
        },
        candidates: [
          {
            name: "Expensive Table",
            source: "fallback",
            category: "restaurant",
            rating: 4.8,
            priceBand: "$$$$",
            reviewSnippets: [],
            lat: 0,
            lng: 0,
            reasonToRecommend: "High-conviction splurge.",
          },
          {
            name: "Budget Bistro",
            source: "fallback",
            category: "restaurant",
            rating: 4.4,
            priceBand: "$$",
            reviewSnippets: [],
            lat: 0,
            lng: 0,
            reasonToRecommend: "Better value.",
          },
        ],
      },
    ],
    itinerary: [
      {
        slotId: "slot-1",
        selectedName: "Expensive Table",
      },
    ],
  });

  assert.equal(budget.fitsBudget, true);
  assert.equal(budget.adjustments[0]?.approvedName, "Budget Bistro");
});

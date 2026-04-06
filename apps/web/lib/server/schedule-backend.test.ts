import test from "node:test";
import assert from "node:assert/strict";
import { createSchedulePlan } from "../../backend/src/services/schedule-plan-service.ts";
import type { SchedulePlanRequest } from "../../backend/src/domain/schedule-plans.ts";
import {
  addSuggestionToSchedulePlanRecord,
  createSchedulePlanRecord,
  fetchSchedulePlanRecord,
} from "./schedule-backend.ts";

function sampleRequest(): SchedulePlanRequest {
  return {
    importedSchedule: {
      source: "ics",
      importedAt: "2026-04-01T00:00:00.000Z",
      timezone: "America/Los_Angeles",
      cityInference: {
        city: "Kyoto",
        region: "Kyoto",
        country: "Japan",
        confidence: 0.8,
        matchedFrom: [],
      },
      warnings: [],
      events: [
        {
          id: "evt-1",
          source: "ics",
          title: "Breakfast meeting",
          description: "",
          location: "Hotel",
          startsAt: "2026-04-11T16:00:00.000Z",
          endsAt: "2026-04-11T17:00:00.000Z",
          isAllDay: false,
          timezone: "America/Los_Angeles",
          type: "meeting",
          inferredCity: "Kyoto",
          locked: true,
        },
        {
          id: "evt-2",
          source: "ics",
          title: "Museum booking",
          description: "",
          location: "Center",
          startsAt: "2026-04-11T20:00:00.000Z",
          endsAt: "2026-04-11T21:00:00.000Z",
          isAllDay: false,
          timezone: "America/Los_Angeles",
          type: "meeting",
          inferredCity: "Kyoto",
          locked: true,
        },
      ],
    },
    preferences: {
      provider: "openai",
      budgetBand: "comfort",
      interests: ["culture", "food"],
      pace: "balanced",
      transport: "walk",
      earliestTime: "08:00",
      latestTime: "20:00",
      comments: "",
    },
    startDate: "2026-04-11",
    endDate: "2026-04-11",
  };
}

test("schedule-backend uses in-process service when BACKEND_URL is unset", async () => {
  const previousBackendUrl = process.env.BACKEND_URL;
  const previousPlacesKey = process.env.GOOGLE_PLACES_API_KEY;
  const previousOpenAIKey = process.env.OPENAI_API_KEY;

  delete process.env.BACKEND_URL;
  delete process.env.GOOGLE_PLACES_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const created = await createSchedulePlanRecord(sampleRequest());
    assert.ok(created.planId);

    const plan = await fetchSchedulePlanRecord(created.planId);
    assert.ok(plan);
    assert.equal(plan?.id, created.planId);

    const updated = await addSuggestionToSchedulePlanRecord(created.planId, plan?.suggestions[0]?.id ?? "");
    assert.equal(updated?.suggestions[0]?.status, "added");
  } finally {
    process.env.BACKEND_URL = previousBackendUrl;
    process.env.GOOGLE_PLACES_API_KEY = previousPlacesKey;
    process.env.OPENAI_API_KEY = previousOpenAIKey;
  }
});

test("schedule-backend proxies create, fetch, and add in BACKEND_URL mode", async () => {
  const previousBackendUrl = process.env.BACKEND_URL;
  const previousFetch = globalThis.fetch;
  const previousPlacesKey = process.env.GOOGLE_PLACES_API_KEY;
  const previousOpenAIKey = process.env.OPENAI_API_KEY;

  delete process.env.GOOGLE_PLACES_API_KEY;
  delete process.env.OPENAI_API_KEY;

  const stored = await createSchedulePlan(sampleRequest());
  process.env.BACKEND_URL = "http://127.0.0.1:8787";
  const seen: string[] = [];

  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
    seen.push(url);

    if (url.endsWith("/api/schedule-plans")) {
      return new Response(JSON.stringify({ planId: stored.id }), { status: 201 });
    }

    if (url.endsWith(`/api/schedule-plans/${stored.id}`)) {
      return new Response(JSON.stringify(stored), { status: 200 });
    }

    if (url.endsWith(`/api/schedule-plans/${stored.id}/suggestions/${stored.suggestions[0]?.id}/add`)) {
      const updated = {
        ...stored,
        suggestions: stored.suggestions.map((suggestion, index) => (
          index === 0 ? { ...suggestion, status: "added", addedEventId: "added-1" } : suggestion
        )),
      };
      return new Response(JSON.stringify(updated), { status: 200 });
    }

    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  try {
    const created = await createSchedulePlanRecord(sampleRequest());
    const fetched = await fetchSchedulePlanRecord(stored.id);
    const updated = await addSuggestionToSchedulePlanRecord(stored.id, stored.suggestions[0]?.id ?? "");

    assert.equal(created.planId, stored.id);
    assert.equal(fetched?.id, stored.id);
    assert.equal(updated?.suggestions[0]?.status, "added");
    assert.deepEqual(seen, [
      "http://127.0.0.1:8787/api/schedule-plans",
      `http://127.0.0.1:8787/api/schedule-plans/${stored.id}`,
      `http://127.0.0.1:8787/api/schedule-plans/${stored.id}/suggestions/${stored.suggestions[0]?.id}/add`,
    ]);
  } finally {
    process.env.BACKEND_URL = previousBackendUrl;
    process.env.GOOGLE_PLACES_API_KEY = previousPlacesKey;
    process.env.OPENAI_API_KEY = previousOpenAIKey;
    globalThis.fetch = previousFetch;
  }
});

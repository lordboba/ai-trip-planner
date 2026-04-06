import test from "node:test";
import assert from "node:assert/strict";
import type { NormalizedCalendarEvent } from "../domain/schedule-plans.ts";
import { resolveTimelineEventMapPins } from "./google-places.ts";

function buildEvent(
  id: string,
  title: string,
  location: string | null,
  startsAt: string,
): NormalizedCalendarEvent {
  return {
    id,
    source: "google",
    sourceEventId: id,
    title,
    description: "",
    location,
    startsAt,
    endsAt: new Date(new Date(startsAt).getTime() + 60 * 60 * 1000).toISOString(),
    isAllDay: false,
    timezone: "Europe/Lisbon",
    type: "other",
    inferredCity: "Lisbon",
    locked: true,
  };
}

test("resolveTimelineEventMapPins resolves event locations and reuses duplicate lookups", async () => {
  const previousPlacesKey = process.env.GOOGLE_PLACES_API_KEY;
  const previousFetch = globalThis.fetch;
  const requestedQueries: string[] = [];

  process.env.GOOGLE_PLACES_API_KEY = "test-key";
  globalThis.fetch = (async (input, init) => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
    assert.equal(url, "https://places.googleapis.com/v1/places:searchText");

    const body = JSON.parse(String(init?.body ?? "{}")) as { textQuery: string };
    requestedQueries.push(body.textQuery);

    const isHotel = body.textQuery.includes("Hotel Avenida Palace");

    return new Response(JSON.stringify({
      places: [{
        id: isHotel ? "hotel-1" : "market-1",
        displayName: { text: isHotel ? "Hotel Avenida Palace" : "Time Out Market Lisboa" },
        formattedAddress: body.textQuery,
        googleMapsUri: `https://maps.google.com/?q=${encodeURIComponent(body.textQuery)}`,
        location: {
          latitude: isHotel ? 38.7137 : 38.7079,
          longitude: isHotel ? -9.1418 : -9.1468,
        },
      }],
    }), { status: 200 });
  }) as typeof fetch;

  try {
    const pins = await resolveTimelineEventMapPins({
      events: [
        buildEvent("evt-1", "Check in", "Hotel Avenida Palace", "2026-04-10T13:00:00.000Z"),
        buildEvent("evt-2", "Drop bags", "Hotel Avenida Palace", "2026-04-10T14:00:00.000Z"),
        buildEvent("evt-3", "Lunch", "Time Out Market, Lisbon", "2026-04-10T16:00:00.000Z"),
        buildEvent("evt-4", "Focus block", null, "2026-04-10T18:00:00.000Z"),
      ],
      fallbackCity: "Lisbon",
    });

    assert.deepEqual(requestedQueries, [
      "Hotel Avenida Palace, Lisbon",
      "Time Out Market, Lisbon",
    ]);
    assert.equal(pins.length, 3);
    assert.equal(pins[0]?.label, "Hotel Avenida Palace");
    assert.equal(pins[1]?.label, "Hotel Avenida Palace");
    assert.equal(pins[2]?.label, "Time Out Market Lisboa");
    assert.deepEqual(
      pins.map((pin) => pin.eventId),
      ["evt-1", "evt-2", "evt-3"],
    );
  } finally {
    process.env.GOOGLE_PLACES_API_KEY = previousPlacesKey;
    globalThis.fetch = previousFetch;
  }
});

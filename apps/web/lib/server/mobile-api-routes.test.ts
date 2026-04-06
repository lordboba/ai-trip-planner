import test from "node:test";
import assert from "node:assert/strict";
import { issueAppSessionToken, verifyAppSessionToken } from "./app-session.ts";
import { importCalendarFile } from "./schedule-backend.ts";
import { createGoogleCalendarEvent } from "./google-calendar-write.ts";

test("app session tokens can be issued and verified for mobile API access", async () => {
  const previousAccessCode = process.env.TRIPWISE_ACCESS_CODE;
  const previousSessionSecret = process.env.TRIPWISE_APP_SESSION_SECRET;

  process.env.TRIPWISE_ACCESS_CODE = "mobile-secret";
  process.env.TRIPWISE_APP_SESSION_SECRET = "mobile-session-secret";

  try {
    const session = await issueAppSessionToken();

    assert.ok(session.token);
    assert.ok(session.expiresAt);
    assert.equal(await verifyAppSessionToken(session.token), true);
  } finally {
    process.env.TRIPWISE_ACCESS_CODE = previousAccessCode;
    process.env.TRIPWISE_APP_SESSION_SECRET = previousSessionSecret;
  }
});

test("calendar import accepts an explicit Google access token", async () => {
  const previousFetch = globalThis.fetch;

  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

    if (url.startsWith("https://www.googleapis.com/calendar/v3/calendars/primary/events")) {
      return new Response(JSON.stringify({
        timeZone: "America/Los_Angeles",
        items: [
          {
            id: "google-1",
            summary: "Flight to Kyoto",
            location: "LAX Airport",
            start: { dateTime: "2026-04-10T10:00:00-07:00", timeZone: "America/Los_Angeles" },
            end: { dateTime: "2026-04-10T12:00:00-07:00", timeZone: "America/Los_Angeles" },
          },
        ],
      }), { status: 200 });
    }

    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  try {
    const imported = await importCalendarFile({
      source: "google",
      startDate: "2026-04-10",
      endDate: "2026-04-10",
      googleAccessToken: "google-access-token",
    });

    assert.equal(imported.source, "google");
    assert.equal(imported.events.length, 1);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("calendar event creation accepts an explicit Google access token", async () => {
  const previousFetch = globalThis.fetch;

  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

    if (url === "https://www.googleapis.com/calendar/v3/calendars/primary/events") {
      return new Response(JSON.stringify({ id: "mobile-added-event" }), { status: 200 });
    }

    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  try {
    const result = await createGoogleCalendarEvent({
      summary: "Dinner reservation",
      description: "A place picked from the mobile flow.",
      location: "Kyoto Station",
      startTime: "2026-04-11T19:00:00.000Z",
      endTime: "2026-04-11T20:30:00.000Z",
      timeZone: "Asia/Tokyo",
      accessToken: "google-access-token",
    });

    assert.equal(result.success, true);
    assert.equal(result.eventId, "mobile-added-event");
  } finally {
    globalThis.fetch = previousFetch;
  }
});

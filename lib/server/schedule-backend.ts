import { z } from "zod";
import { schedulePlanSchema, schedulePlanRequestSchema } from "../../backend/src/domain/schedule-plans.ts";
import { importCalendarFromIcsText } from "../../backend/src/services/calendar-import-service.ts";
import { importCalendarFromGoogleEvents } from "../../backend/src/services/google-calendar.ts";
import {
  addSuggestionToSchedulePlan,
  createSchedulePlan,
  getSchedulePlanById,
} from "../../backend/src/services/schedule-plan-service.ts";
import type { SchedulePlan, SchedulePlanRequest } from "../types.ts";

const createSchedulePlanResponseSchema = z.object({
  planId: z.string().uuid(),
});

const googleConnectResponseSchema = z.object({
  ok: z.boolean(),
  provider: z.literal("google-calendar"),
  status: z.literal("ready"),
  message: z.string(),
  authorizeUrl: z.string().url().optional(),
});

function getBackendUrl() {
  const backendUrl = process.env.BACKEND_URL?.trim();

  if (!backendUrl) {
    return null;
  }

  return backendUrl.endsWith("/") ? backendUrl.slice(0, -1) : backendUrl;
}

export async function importCalendarFile(input: {
  icsText?: string;
  source?: "ics" | "google";
  startDate?: string | null;
  endDate?: string | null;
  googleAccessToken?: string | null;
}) {
  if (input.source === "google") {
    if (!input.googleAccessToken) {
      throw new Error("Google Calendar access token is missing.");
    }

    return importCalendarFromGoogleEvents({
      accessToken: input.googleAccessToken,
      startDate: input.startDate,
      endDate: input.endDate,
    });
  }

  if (!input.icsText) {
    throw new Error("ICS content is required for non-Google calendar imports.");
  }

  return importCalendarFromIcsText({
    icsText: input.icsText,
    source: input.source,
    startDate: input.startDate,
    endDate: input.endDate,
  });
}

export async function createSchedulePlanRecord(request: SchedulePlanRequest) {
  const parsedRequest = schedulePlanRequestSchema.parse(request);
  const backendUrl = getBackendUrl();

  if (!backendUrl) {
    const stored = await createSchedulePlan(parsedRequest);
    return { planId: stored.id };
  }

  const response = await fetch(`${backendUrl}/api/schedule-plans`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(parsedRequest),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`External backend schedule plan creation failed with status ${response.status}.`);
  }

  return createSchedulePlanResponseSchema.parse(await response.json());
}

export async function fetchSchedulePlanRecord(planId: string): Promise<SchedulePlan | null> {
  const backendUrl = getBackendUrl();

  if (!backendUrl) {
    return getSchedulePlanById(planId) ?? null;
  }

  const response = await fetch(`${backendUrl}/api/schedule-plans/${planId}`, {
    method: "GET",
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`External backend schedule plan fetch failed with status ${response.status}.`);
  }

  return schedulePlanSchema.parse(await response.json());
}

export async function addSuggestionToSchedulePlanRecord(planId: string, suggestionId: string): Promise<SchedulePlan | null> {
  const backendUrl = getBackendUrl();

  if (!backendUrl) {
    return addSuggestionToSchedulePlan(planId, suggestionId);
  }

  const response = await fetch(`${backendUrl}/api/schedule-plans/${planId}/suggestions/${suggestionId}/add`, {
    method: "POST",
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`External backend suggestion add failed with status ${response.status}.`);
  }

  return schedulePlanSchema.parse(await response.json());
}

export async function connectGoogleCalendar(
  input?: { startDate?: string | null; endDate?: string | null },
) {
  const { createGoogleAuthorizeUrl } = await import("./google-calendar-auth.ts");
  const authorizeUrl = await createGoogleAuthorizeUrl(input);

  return googleConnectResponseSchema.parse({
    ok: true,
    provider: "google-calendar",
    status: "ready",
    message: "Google Calendar OAuth is ready.",
    authorizeUrl,
  });
}

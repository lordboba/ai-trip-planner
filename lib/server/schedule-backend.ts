import { z } from "zod";
import { importedCalendarSchema, schedulePlanSchema, schedulePlanRequestSchema } from "@/backend/src/domain/schedule-plans";
import { importCalendarFromIcsText } from "@/backend/src/services/calendar-import-service";
import {
  addSuggestionToSchedulePlan,
  createSchedulePlan,
  getSchedulePlanById,
} from "@/backend/src/services/schedule-plan-service";
import type { ImportedCalendar, SchedulePlan, SchedulePlanRequest } from "@/lib/types";

const createSchedulePlanResponseSchema = z.object({
  planId: z.string().uuid(),
});

const googleConnectResponseSchema = z.object({
  ok: z.boolean(),
  provider: z.literal("google-calendar"),
  status: z.literal("ready"),
  message: z.string(),
});

function getBackendUrl() {
  const backendUrl = process.env.BACKEND_URL?.trim();

  if (!backendUrl) {
    return null;
  }

  return backendUrl.endsWith("/") ? backendUrl.slice(0, -1) : backendUrl;
}

export async function importCalendarFile(input: {
  icsText: string;
  source?: "ics" | "google";
  startDate?: string | null;
  endDate?: string | null;
}) {
  const backendUrl = getBackendUrl();

  if (!backendUrl) {
    return importCalendarFromIcsText(input);
  }

  const response = await fetch(`${backendUrl}/api/calendar/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ics: input.icsText,
      source: input.source ?? "ics",
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`External backend calendar import failed with status ${response.status}.`);
  }

  return importedCalendarSchema.parse(await response.json());
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

export async function connectGoogleCalendar(requestCookieHeader?: string) {
  const backendUrl = getBackendUrl();

  if (!backendUrl) {
    return googleConnectResponseSchema.parse({
      ok: true,
      provider: "google-calendar",
      status: "ready",
      message: "Google Calendar connection is reserved for authenticated users. Upload an .ics file for now while direct sync is offline.",
    });
  }

  const response = await fetch(`${backendUrl}/api/calendar/google/connect`, {
    method: "POST",
    headers: requestCookieHeader ? { cookie: requestCookieHeader } : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`External backend Google connect handshake failed with status ${response.status}.`);
  }

  return googleConnectResponseSchema.parse(await response.json());
}

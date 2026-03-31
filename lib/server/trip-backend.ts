import { z } from "zod";
import { storedTripSchema, tripRequestSchema } from "@/backend/src/domain/trips";
import { createTrip, getTripById } from "@/backend/src/services/trip-service";
import type { StoredTrip, TripRequest } from "@/lib/types";

const createTripResponseSchema = z.object({
  tripId: z.string().uuid(),
});

function getBackendUrl() {
  const backendUrl = process.env.BACKEND_URL?.trim();

  if (!backendUrl) {
    return null;
  }

  return backendUrl.endsWith("/") ? backendUrl.slice(0, -1) : backendUrl;
}

export function isExternalBackendConfigured() {
  return Boolean(getBackendUrl());
}

export async function createTripRecord(request: TripRequest) {
  const parsedRequest = tripRequestSchema.parse(request);
  const backendUrl = getBackendUrl();

  if (!backendUrl) {
    const stored = await createTrip(parsedRequest);
    return { tripId: stored.id };
  }

  const response = await fetch(`${backendUrl}/api/trips`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(parsedRequest),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`External backend trip creation failed with status ${response.status}.`);
  }

  return createTripResponseSchema.parse(await response.json());
}

export async function fetchTripRecord(tripId: string): Promise<StoredTrip | null> {
  const backendUrl = getBackendUrl();

  if (!backendUrl) {
    return getTripById(tripId) ?? null;
  }

  const response = await fetch(`${backendUrl}/api/trips/${tripId}`, {
    method: "GET",
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`External backend trip fetch failed with status ${response.status}.`);
  }

  return storedTripSchema.parse(await response.json());
}

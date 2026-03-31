import type { StoredTrip, TripRequest } from "../domain/trips.ts";
import { buildMockTripPlan } from "./mock-trip-planner.ts";
import { getStoredTrip, saveTrip } from "../store/trip-store.ts";

export function createTrip(request: TripRequest) {
  const stored: StoredTrip = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    request,
    plan: buildMockTripPlan(request),
  };

  return saveTrip(stored);
}

export function getTripById(tripId: string) {
  return getStoredTrip(tripId);
}

import { storedTripSchema, type StoredTrip, type TripRequest } from "../domain/trips.ts";
import { buildStructuredTrip } from "./mock-trip-planner.ts";
import { getStoredTrip, saveTrip } from "../store/trip-store.ts";

export async function createTrip(request: TripRequest) {
  const generated = await buildStructuredTrip(request);

  const stored: StoredTrip = storedTripSchema.parse({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    request,
    workflow: generated.workflow,
    plan: generated.plan,
  });

  return saveTrip(stored);
}

export function getTripById(tripId: string) {
  return getStoredTrip(tripId);
}

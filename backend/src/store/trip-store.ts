import type { StoredTrip } from "../domain/trips.ts";

type GlobalStore = typeof globalThis & {
  __atlasTrips__?: Map<string, StoredTrip>;
};

function getStore() {
  const globalStore = globalThis as GlobalStore;

  if (!globalStore.__atlasTrips__) {
    globalStore.__atlasTrips__ = new Map<string, StoredTrip>();
  }

  return globalStore.__atlasTrips__;
}

export function saveTrip(trip: StoredTrip) {
  const store = getStore();
  store.set(trip.id, trip);
  return trip;
}

export function getStoredTrip(id: string) {
  return getStore().get(id);
}

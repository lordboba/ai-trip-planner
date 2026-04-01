"use client";

import type { TripPlan, TripRequest } from "@/lib/types";

const SAVED_TRIPS_KEY = "tripwise.saved-trips";
const MAX_SAVED_TRIPS = 12;

export type SavedTripSnapshot = {
  id: string;
  tripId: string;
  savedAt: string;
  request: TripRequest;
  plan: TripPlan;
};

function readRawSavedTrips() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(SAVED_TRIPS_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getSavedTrips(): SavedTripSnapshot[] {
  return readRawSavedTrips()
    .filter((entry): entry is SavedTripSnapshot => {
      if (!entry || typeof entry !== "object") {
        return false;
      }

      return typeof entry.id === "string"
        && typeof entry.tripId === "string"
        && typeof entry.savedAt === "string"
        && Boolean(entry.request)
        && Boolean(entry.plan);
    })
    .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
}

export function saveTripSnapshot(snapshot: SavedTripSnapshot) {
  if (typeof window === "undefined") {
    return;
  }

  const existing = getSavedTrips().filter((entry) => entry.id !== snapshot.id);
  const next = [snapshot, ...existing].slice(0, MAX_SAVED_TRIPS);
  window.localStorage.setItem(SAVED_TRIPS_KEY, JSON.stringify(next));
}

export function getSavedTripById(id: string) {
  return getSavedTrips().find((entry) => entry.id === id) ?? null;
}

import { createTripPlannerApiClient } from "@ai-trip-planner/api-client";

export const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? "";

export function createMobileApiClient(sessionToken?: string | null) {
  return createTripPlannerApiClient({
    baseUrl: apiBaseUrl,
    getSessionToken: () => sessionToken ?? null,
  });
}

export function assertApiBaseUrl() {
  if (!apiBaseUrl) {
    throw new Error("Set EXPO_PUBLIC_API_BASE_URL to your web app origin before using the mobile app.");
  }
}

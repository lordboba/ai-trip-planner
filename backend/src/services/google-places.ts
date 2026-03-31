import { z } from "zod";
import type { PlaceCandidate, TravelerProfile } from "../domain/trips.ts";

const reviewTextSchema = z.object({
  text: z.string().optional(),
}).passthrough();

const googleReviewSchema = z.object({
  text: reviewTextSchema.optional(),
  originalText: reviewTextSchema.optional(),
}).passthrough();

const googlePlaceSchema = z.object({
  id: z.string().optional(),
  displayName: z.object({ text: z.string().optional() }).optional(),
  formattedAddress: z.string().optional(),
  googleMapsUri: z.string().optional(),
  primaryType: z.string().optional(),
  types: z.array(z.string()).optional(),
  rating: z.number().optional(),
  userRatingCount: z.number().optional(),
  priceLevel: z.string().optional(),
  reviewSummary: reviewTextSchema.optional(),
  reviews: z.array(googleReviewSchema).optional(),
  location: z.object({
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  }).optional(),
}).passthrough();

const googleTextSearchResponseSchema = z.object({
  places: z.array(googlePlaceSchema).optional(),
}).passthrough();

const googleAutocompleteSuggestionSchema = z.object({
  placePrediction: z.object({
    placeId: z.string().optional(),
    text: z.object({ text: z.string().optional() }).optional(),
    structuredFormat: z.object({
      mainText: z.object({ text: z.string().optional() }).optional(),
      secondaryText: z.object({ text: z.string().optional() }).optional(),
    }).optional(),
    types: z.array(z.string()).optional(),
  }).optional(),
}).passthrough();

const googleAutocompleteResponseSchema = z.object({
  suggestions: z.array(googleAutocompleteSuggestionSchema).optional(),
}).passthrough();

type SearchPlacesParams = {
  textQuery: string;
  maxResultCount?: number;
};

type DestinationSearchParams = {
  destinationTitle: string;
  neighborhood: string;
  travelerProfile: TravelerProfile;
};

export type DestinationSuggestion = {
  placeId: string;
  text: string;
  mainText: string;
  secondaryText: string;
  types: string[];
};

const TEXT_SEARCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.googleMapsUri",
  "places.location",
  "places.primaryType",
  "places.types",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.reviewSummary",
  "places.reviews",
].join(",");

function getApiKey() {
  return process.env.GOOGLE_PLACES_API_KEY?.trim() || null;
}

export function isGooglePlacesConfigured() {
  return Boolean(getApiKey());
}

function mapPriceLevel(priceLevel?: string) {
  switch (priceLevel) {
    case "PRICE_LEVEL_FREE":
      return "$";
    case "PRICE_LEVEL_INEXPENSIVE":
      return "$";
    case "PRICE_LEVEL_MODERATE":
      return "$$";
    case "PRICE_LEVEL_EXPENSIVE":
      return "$$$";
    case "PRICE_LEVEL_VERY_EXPENSIVE":
      return "$$$$";
    default:
      return "$$";
  }
}

function normalizeCategory(place: z.infer<typeof googlePlaceSchema>) {
  return place.primaryType ?? place.types?.[0] ?? "point_of_interest";
}

function reviewSnippet(review: z.infer<typeof googleReviewSchema>) {
  return review.originalText?.text?.trim() || review.text?.text?.trim() || null;
}

function normalizePlace(place: z.infer<typeof googlePlaceSchema>): PlaceCandidate | null {
  const name = place.displayName?.text?.trim();
  const lat = place.location?.latitude;
  const lng = place.location?.longitude;

  if (!name || typeof lat !== "number" || typeof lng !== "number") {
    return null;
  }

  const reviewSnippets = (place.reviews ?? [])
    .map(reviewSnippet)
    .filter((value): value is string => Boolean(value))
    .slice(0, 3);

  return {
    placeId: place.id,
    name,
    source: "google-places",
    category: normalizeCategory(place),
    rating: place.rating ?? 0,
    priceBand: mapPriceLevel(place.priceLevel),
    reviewSnippets,
    reviewSummary: place.reviewSummary?.text?.trim(),
    address: place.formattedAddress,
    lat,
    lng,
    googleMapsUri: place.googleMapsUri,
    reasonToRecommend: "",
  };
}

function dedupePlaces(places: readonly PlaceCandidate[]) {
  const seen = new Set<string>();
  const output: PlaceCandidate[] = [];

  for (const place of places) {
    const key = place.placeId || place.name.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(place);
  }

  return output;
}

async function searchPlacesText({ textQuery, maxResultCount = 5 }: SearchPlacesParams): Promise<PlaceCandidate[]> {
  const apiKey = getApiKey();

  if (!apiKey) {
    return [];
  }

  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": TEXT_SEARCH_FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery,
      maxResultCount,
      languageCode: process.env.GOOGLE_PLACES_LANGUAGE_CODE?.trim() || "en",
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throw new Error(`Google Places Text Search failed with status ${response.status}: ${await response.text()}`);
  }

  const payload = googleTextSearchResponseSchema.parse(await response.json());

  return dedupePlaces(
    (payload.places ?? [])
      .map(normalizePlace)
      .filter((place): place is PlaceCandidate => Boolean(place)),
  );
}

export async function autocompleteDestinationSearch(input: string, sessionToken?: string): Promise<DestinationSuggestion[]> {
  const apiKey = getApiKey();
  const trimmed = input.trim();

  if (!apiKey || trimmed.length < 2) {
    return [];
  }

  const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": [
        "suggestions.placePrediction.placeId",
        "suggestions.placePrediction.text.text",
        "suggestions.placePrediction.structuredFormat.mainText.text",
        "suggestions.placePrediction.structuredFormat.secondaryText.text",
        "suggestions.placePrediction.types",
      ].join(","),
    },
    body: JSON.stringify({
      input: trimmed,
      languageCode: process.env.GOOGLE_PLACES_LANGUAGE_CODE?.trim() || "en",
      includeQueryPredictions: false,
      includedPrimaryTypes: ["(cities)"],
      sessionToken,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Google Places autocomplete failed with status ${response.status}: ${await response.text()}`);
  }

  const payload = googleAutocompleteResponseSchema.parse(await response.json());

  return (payload.suggestions ?? [])
    .map((suggestion) => {
      const prediction = suggestion.placePrediction;

      if (!prediction) {
        return null;
      }

      const placeId = prediction.placeId?.trim();
      const text = prediction.text?.text?.trim();

      if (!placeId || !text) {
        return null;
      }

      return {
        placeId,
        text,
        mainText: prediction.structuredFormat?.mainText?.text?.trim() || text,
        secondaryText: prediction.structuredFormat?.secondaryText?.text?.trim() || "",
        types: prediction.types ?? [],
      } satisfies DestinationSuggestion;
    })
    .filter((suggestion): suggestion is DestinationSuggestion => Boolean(suggestion))
    .slice(0, 5);
}

function diningQueries({ destinationTitle, neighborhood }: DestinationSearchParams) {
  const anchor = `${neighborhood}, ${destinationTitle}`;

  return [
    `best restaurants in ${anchor}`,
    `best cafes in ${anchor}`,
  ];
}

function activityQueries({ destinationTitle, neighborhood, travelerProfile }: DestinationSearchParams) {
  const anchor = `${neighborhood}, ${destinationTitle}`;
  const queries = [`best things to do in ${anchor}`];

  if (travelerProfile.interests.includes("culture")) {
    queries.push(`best museums and galleries in ${anchor}`);
  }

  if (travelerProfile.interests.includes("nature")) {
    queries.push(`best parks and scenic walks in ${anchor}`);
  }

  if (travelerProfile.interests.includes("nightlife")) {
    queries.push(`best bars and nightlife in ${anchor}`);
  }

  return queries;
}

function lodgingQuery({ destinationTitle, neighborhood, travelerProfile }: DestinationSearchParams) {
  const anchor = `${neighborhood}, ${destinationTitle}`;
  return `best ${travelerProfile.lodgingStyle} stays in ${anchor}`;
}

export async function fetchGooglePlacesCandidates(params: DestinationSearchParams) {
  if (!isGooglePlacesConfigured()) {
    return {
      dining: [] as PlaceCandidate[],
      activities: [] as PlaceCandidate[],
      lodging: [] as PlaceCandidate[],
      live: false,
      reason: "GOOGLE_PLACES_API_KEY is not configured.",
    };
  }

  try {
    const diningResults = await Promise.all(diningQueries(params).map((textQuery) => searchPlacesText({ textQuery, maxResultCount: 4 })));
    const activityResults = await Promise.all(activityQueries(params).map((textQuery) => searchPlacesText({ textQuery, maxResultCount: 4 })));
    const lodgingResults = await searchPlacesText({ textQuery: lodgingQuery(params), maxResultCount: 4 });

    return {
      dining: dedupePlaces(diningResults.flat()).slice(0, 6),
      activities: dedupePlaces(activityResults.flat()).slice(0, 6),
      lodging: lodgingResults.slice(0, 4),
      live: true,
      reason: null,
    };
  } catch (error) {
    return {
      dining: [] as PlaceCandidate[],
      activities: [] as PlaceCandidate[],
      lodging: [] as PlaceCandidate[],
      live: false,
      reason: error instanceof Error ? error.message : "Google Places lookup failed.",
    };
  }
}

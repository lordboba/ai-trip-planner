import { z } from "zod";
import type { BudgetBand, PlaceCandidate } from "../domain/planning.ts";
import type { NormalizedCalendarEvent, ScheduleGapKind } from "../domain/schedule-plans.ts";

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

export type DestinationSuggestion = {
  placeId: string;
  text: string;
  mainText: string;
  secondaryText: string;
  types: string[];
};

export type SlotPlaceLookupParams = {
  slotKind: ScheduleGapKind;
  city: string | null;
  interests: readonly string[];
  budgetBand: BudgetBand;
  durationMinutes: number;
  previousEventTitle?: string | null;
  nextEventTitle?: string | null;
  previousEventLocation?: string | null;
  nextEventLocation?: string | null;
};

export type TimelineEventMapPin = {
  eventId: string;
  lat: number;
  lng: number;
  label: string;
  address?: string;
  googleMapsUri?: string;
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

const QUICK_STOP_QUERY_MAP: Record<string, string[]> = {
  food: ["best coffee shops in {anchor}", "best bakeries in {anchor}"],
  nightlife: ["best cocktail bars in {anchor}", "best wine bars in {anchor}"],
  nature: ["best parks in {anchor}", "best scenic walks in {anchor}"],
  culture: ["best galleries in {anchor}", "best museums in {anchor}"],
  shopping: ["best boutiques in {anchor}", "best design stores in {anchor}"],
  wellness: ["best tea houses in {anchor}", "best quiet cafes in {anchor}"],
  adventure: ["best viewpoints in {anchor}", "best landmark detours in {anchor}"],
  "hidden gems": ["hidden gems in {anchor}", "best neighborhood spots in {anchor}"],
};

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

function normalizeLookupKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function appendLocationContext(base: string, extra: string | null | undefined) {
  const trimmedExtra = extra?.trim();

  if (!trimmedExtra) {
    return base;
  }

  return base.toLowerCase().includes(trimmedExtra.toLowerCase()) ? base : `${base}, ${trimmedExtra}`;
}

function buildEventLocationQuery(event: NormalizedCalendarEvent, fallbackCity?: string | null) {
  const location = event.location?.trim();

  if (!location) {
    return null;
  }

  const withInferredCity = appendLocationContext(location, event.inferredCity);
  return appendLocationContext(withInferredCity, fallbackCity);
}

function priceBandScore(priceBand: string) {
  const dollarCount = (priceBand.match(/\$/g) ?? []).length;
  return dollarCount > 0 ? dollarCount : 2;
}

function isBudgetFit(place: PlaceCandidate, budgetBand: BudgetBand) {
  const score = priceBandScore(place.priceBand);

  if (budgetBand === "lean") return score <= 2;
  if (budgetBand === "comfort") return score >= 2 && score <= 3;
  return score >= 3;
}

function sortForBudget(places: readonly PlaceCandidate[], budgetBand: BudgetBand) {
  return [...places].sort((left, right) => {
    const fitDelta = Number(isBudgetFit(right, budgetBand)) - Number(isBudgetFit(left, budgetBand));

    if (fitDelta !== 0) {
      return fitDelta;
    }

    return right.rating - left.rating;
  });
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

function slotAnchor(params: SlotPlaceLookupParams) {
  const locationHint = params.previousEventLocation?.trim() || params.nextEventLocation?.trim();
  return appendLocationContext(locationHint || params.city?.trim() || "the city center", params.city);
}

function journeyContext(params: SlotPlaceLookupParams) {
  const previous = params.previousEventLocation?.trim() || params.previousEventTitle?.trim() || null;
  const next = params.nextEventLocation?.trim() || params.nextEventTitle?.trim() || null;

  if (previous && next && previous.toLowerCase() !== next.toLowerCase()) {
    return `${previous} and ${next}`;
  }

  return previous || next;
}

function mealQueries(params: SlotPlaceLookupParams) {
  const anchor = slotAnchor(params);
  const context = journeyContext(params);

  return [
    `best restaurants near ${anchor}`,
    `best cafes near ${anchor}`,
    context ? `reliable restaurants between ${context} near ${anchor}` : `reliable lunch spots near ${anchor}`,
  ];
}

function quickStopQueries(params: SlotPlaceLookupParams) {
  const anchor = slotAnchor(params);
  const templates = params.interests.flatMap((interest) => QUICK_STOP_QUERY_MAP[interest] ?? []);
  const uniqueTemplates = templates.length > 0
    ? [...new Set(templates)]
    : ["best cafes in {anchor}", "best neighborhood spots in {anchor}"];

  const resolved = uniqueTemplates.map((template) => template.replaceAll("{anchor}", anchor));
  const journey = journeyContext(params);

  if (journey) {
    resolved.push(`best quick detours near ${journey} in ${anchor}`);
  }

  if (params.durationMinutes >= 75) {
    resolved.push(`best things to do in ${anchor}`);
  }

  return [...new Set(resolved)].slice(0, 4);
}

export async function fetchSlotPlaceCandidates(params: SlotPlaceLookupParams) {
  if (!isGooglePlacesConfigured()) {
    return {
      candidates: [] as PlaceCandidate[],
      live: false,
      reason: "GOOGLE_PLACES_API_KEY is not configured.",
    };
  }

  try {
    const queries = params.slotKind === "meal-window" ? mealQueries(params) : quickStopQueries(params);
    const results = await Promise.all(queries.map((textQuery) => searchPlacesText({ textQuery, maxResultCount: 4 })));

    return {
      candidates: sortForBudget(dedupePlaces(results.flat()), params.budgetBand).slice(0, 6),
      live: true,
      reason: null,
    };
  } catch (error) {
    return {
      candidates: [] as PlaceCandidate[],
      live: false,
      reason: error instanceof Error ? error.message : "Google Places lookup failed.",
    };
  }
}

export async function resolveTimelineEventMapPins(input: {
  events: readonly NormalizedCalendarEvent[];
  fallbackCity?: string | null;
}) {
  if (!isGooglePlacesConfigured()) {
    return [] as TimelineEventMapPin[];
  }

  const lookupPromises = new Map<string, Promise<PlaceCandidate | null>>();

  for (const event of input.events) {
    const query = buildEventLocationQuery(event, input.fallbackCity);

    if (!query) {
      continue;
    }

    const key = normalizeLookupKey(query);

    if (!lookupPromises.has(key)) {
      lookupPromises.set(
        key,
        searchPlacesText({ textQuery: query, maxResultCount: 1 })
          .then((places) => places[0] ?? null)
          .catch(() => null),
      );
    }
  }

  const resolvedLookups = new Map<string, PlaceCandidate | null>(
    await Promise.all(
      [...lookupPromises.entries()].map(async ([key, promise]) => [key, await promise] as const),
    ),
  );

  return input.events.flatMap((event) => {
    const query = buildEventLocationQuery(event, input.fallbackCity);

    if (!query) {
      return [];
    }

    const match = resolvedLookups.get(normalizeLookupKey(query));

    if (!match) {
      return [];
    }

    return [{
      eventId: event.id,
      lat: match.lat,
      lng: match.lng,
      label: match.name,
      address: match.address,
      googleMapsUri: match.googleMapsUri,
    } satisfies TimelineEventMapPin];
  });
}

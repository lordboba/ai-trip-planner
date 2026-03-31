import { z } from "zod";
import { getProviderAdapter } from "./ai/adapter-factory.ts";
import { fetchGooglePlacesCandidates } from "./google-places.ts";
import type {
  GenerationMetadata,
  PlaceCandidate,
  StoredTrip,
  TripPlan,
  TripRequest,
  TripWorkflow,
  WorkflowStep,
  WorkflowStepResult,
} from "../domain/trips.ts";

const cityCatalog = {
  lisbon: {
    title: "Lisbon, Portugal",
    neighborhood: "Principe Real",
    overview: "Lisbon wins on layered food culture, easy wandering, and enough elegance to feel like a splurge without becoming rigid.",
    dining: [
      {
        name: "Prado",
        source: "mock",
        category: "restaurant",
        rating: 4.8,
        priceBand: "$$$",
        reviewSnippets: ["Vegetable-forward and polished without feeling formal.", "A special dinner that still feels warm."],
        lat: 38.7115,
        lng: -9.132,
        reasonToRecommend: "Matches a traveler who wants one standout dinner, strong produce, and a room that feels design-led instead of stiff.",
      },
      {
        name: "Hello, Kristof",
        source: "mock",
        category: "cafe",
        rating: 4.7,
        priceBand: "$$",
        reviewSnippets: ["Coffee-first mornings and a calm neighborhood rhythm.", "Great reset point before a walking day."],
        lat: 38.7168,
        lng: -9.1491,
        reasonToRecommend: "Fits the coffee priority and gives the itinerary a softer morning anchor.",
      },
    ],
    activities: [
      {
        name: "Feira da Ladra + Alfama drift",
        source: "mock",
        category: "market",
        rating: 4.6,
        priceBand: "$",
        reviewSnippets: ["Best enjoyed without rushing.", "Feels local if you let the day unfold."],
        lat: 38.7152,
        lng: -9.1218,
        reasonToRecommend: "Supports a hidden-gems and wandering-heavy trip without locking the traveler into a rigid ticketed experience.",
      },
      {
        name: "Miradouro circuit",
        source: "mock",
        category: "scenic",
        rating: 4.7,
        priceBand: "$",
        reviewSnippets: ["Viewpoint hopping feels cinematic at golden hour.", "Pairs well with slow afternoons."],
        lat: 38.7137,
        lng: -9.1336,
        reasonToRecommend: "Adds city texture and scenic payoff without heavy logistics.",
      },
    ],
  },
  kyoto: {
    title: "Kyoto, Japan",
    neighborhood: "Higashiyama",
    overview: "Kyoto works when the traveler wants ritual, strong neighborhood identity, and a trip paced around quiet detail rather than nightlife volume.",
    dining: [
      {
        name: "K36 Rooftop Bar",
        source: "mock",
        category: "bar",
        rating: 4.6,
        priceBand: "$$$",
        reviewSnippets: ["Best reserved for one intentional evening.", "Atmosphere-led without turning chaotic."],
        lat: 35,
        lng: 135.7827,
        reasonToRecommend: "Works as a controlled splurge for a traveler who still wants mood and polish.",
      },
      {
        name: "Weekenders Coffee",
        source: "mock",
        category: "cafe",
        rating: 4.8,
        priceBand: "$$",
        reviewSnippets: ["Minimal but memorable.", "Excellent stop before market and shrine wandering."],
        lat: 35.0054,
        lng: 135.7594,
        reasonToRecommend: "Keeps the mornings sharp and aligns with travelers who care about coffee quality and neighborhood texture.",
      },
    ],
    activities: [
      {
        name: "Philosopher's Path morning",
        source: "mock",
        category: "walk",
        rating: 4.8,
        priceBand: "$",
        reviewSnippets: ["Best very early.", "A calm counterweight to busier temple zones."],
        lat: 35.0266,
        lng: 135.7982,
        reasonToRecommend: "Ideal for a relaxed or balanced pace with strong scenic payoff and low friction.",
      },
      {
        name: "Nishiki Market edit",
        source: "mock",
        category: "food market",
        rating: 4.5,
        priceBand: "$$",
        reviewSnippets: ["Go with a short list, not a checklist.", "Works best as a curated graze."],
        lat: 35.005,
        lng: 135.7649,
        reasonToRecommend: "Lets the food agent give variety without overstuffing the day.",
      },
    ],
  },
  mexicoCity: {
    title: "Mexico City, Mexico",
    neighborhood: "Roma Norte",
    overview: "Mexico City is the strongest fit for travelers who want density, food depth, strong neighborhoods, and a slightly more exploratory rhythm.",
    dining: [
      {
        name: "Meroma",
        source: "mock",
        category: "restaurant",
        rating: 4.8,
        priceBand: "$$$",
        reviewSnippets: ["Refined without losing warmth.", "Excellent one-night splurge."],
        lat: 19.4146,
        lng: -99.1701,
        reasonToRecommend: "A strong anchor dinner for a comfort-budget traveler who wants one high-conviction meal.",
      },
      {
        name: "Cicatriz Cafe",
        source: "mock",
        category: "cafe",
        rating: 4.6,
        priceBand: "$$",
        reviewSnippets: ["Lively but not overwhelming during the day.", "Good launch point for a Roma walk."],
        lat: 19.4141,
        lng: -99.1663,
        reasonToRecommend: "Keeps the itinerary social and design-forward without pushing into full nightlife mode.",
      },
    ],
    activities: [
      {
        name: "Roma to Condesa gallery drift",
        source: "mock",
        category: "walk",
        rating: 4.7,
        priceBand: "$",
        reviewSnippets: ["A city made for layered wandering.", "Best with room for detours."],
        lat: 19.4127,
        lng: -99.1699,
        reasonToRecommend: "Supports hidden gems, coffee stops, and neighborhood-first planning.",
      },
      {
        name: "Museo Frida Kahlo timed visit",
        source: "mock",
        category: "museum",
        rating: 4.5,
        priceBand: "$$",
        reviewSnippets: ["Worth booking ahead.", "Pairs well with a lighter afternoon."],
        lat: 19.3553,
        lng: -99.1626,
        reasonToRecommend: "Adds one structured cultural stop without over-formalizing the itinerary.",
      },
    ],
  },
} as const;

const profileOutputSchema = z.object({
  travelerSignal: z.string(),
  constraintsSummary: z.string(),
  preferredPace: z.string(),
});

const destinationOutputSchema = z.object({
  cityKey: z.enum(["lisbon", "kyoto", "mexicoCity"]),
  destinationTitle: z.string(),
  neighborhood: z.string(),
  rationale: z.string(),
});

const recommendationOutputSchema = z.object({
  selectedNames: z.array(z.string()).min(1).max(3),
  rationale: z.string(),
});

const lodgingOutputSchema = z.object({
  lodgingName: z.string(),
  neighborhood: z.string(),
  rationale: z.string(),
});

const itineraryBlockOutputSchema = z.object({
  title: z.string(),
  venue: z.string(),
  note: z.string(),
  reservationSuggested: z.boolean(),
});

const itineraryDayOutputSchema = z.object({
  date: z.string(),
  dateLabel: z.string(),
  morning: itineraryBlockOutputSchema,
  afternoon: itineraryBlockOutputSchema,
  evening: itineraryBlockOutputSchema,
  transitNotes: z.string(),
  reservationFlags: z.array(z.string()),
  budgetEstimate: z.string(),
});

const itineraryOutputSchema = z.object({
  rhythm: z.string(),
  days: z.array(itineraryDayOutputSchema).min(1).max(5),
});

const budgetOutputSchema = z.object({
  budgetBand: z.string(),
  fitsBudget: z.boolean(),
  rationale: z.string(),
});

const finalizeOutputSchema = z.object({
  reviewStrategy: z.string(),
  shareSummary: z.string(),
});

type CityKey = keyof typeof cityCatalog;
type WorkflowContext = {
  request: TripRequest;
  cityKey: CityKey;
  city: (typeof cityCatalog)[CityKey];
  dining: readonly PlaceCandidate[];
  activities: readonly PlaceCandidate[];
  lodging: readonly PlaceCandidate[];
};

type StepExecution<T> = {
  output: T;
  execution: GenerationMetadata;
};

function chooseCityKey(request: TripRequest): CityKey {
  const query = request.destinationContext.destinationQuery.toLowerCase();
  const shortlist = request.destinationContext.shortlist.map((item) => item.toLowerCase());
  const interests = request.travelerProfile.interests;

  if (query.includes("lisbon") || shortlist.some((item) => item.includes("lisbon"))) return "lisbon";
  if (query.includes("kyoto") || shortlist.some((item) => item.includes("kyoto"))) return "kyoto";
  if (query.includes("mexico") || shortlist.some((item) => item.includes("mexico"))) return "mexicoCity";

  if (interests.includes("nightlife") || interests.includes("hidden gems")) return "mexicoCity";
  if (interests.includes("nature") || request.travelerProfile.pace === "relaxed") return "kyoto";
  return "lisbon";
}

function formatDateLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function getDayCount(request: TripRequest) {
  const tripLength = (new Date(request.travelerProfile.endDate).getTime() - new Date(request.travelerProfile.startDate).getTime()) / 86400000;
  return Math.max(3, Math.min(5, Math.round(tripLength) + 1 || 3));
}

function getPlanningDates(request: TripRequest) {
  const dayCount = getDayCount(request);
  const start = new Date(request.travelerProfile.startDate);

  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date: date.toISOString(),
      dateLabel: formatDateLabel(date),
    };
  });
}

function budgetEstimateFor(request: TripRequest) {
  return request.travelerProfile.budgetBand === "luxury"
    ? "$320-420"
    : request.travelerProfile.budgetBand === "comfort"
      ? "$180-260"
      : "$90-140";
}

function buildDay(
  index: number,
  request: TripRequest,
  dining: readonly PlaceCandidate[],
  activities: readonly PlaceCandidate[],
): z.infer<typeof itineraryDayOutputSchema> {
  const planningDates = getPlanningDates(request);
  const currentDate = planningDates[index] ?? planningDates[0];
  const activity = activities[index % activities.length] ?? activities[0];
  const dinner = dining[index % dining.length] ?? dining[0];
  const morningCafe = dining[1] ?? dining[0];

  return {
    date: currentDate.date,
    dateLabel: currentDate.dateLabel,
    morning: {
      title: index === 0 ? `Neighborhood landing walk + ${morningCafe.name}` : activity.name,
      venue: index === 0 ? morningCafe.name : activity.name,
      note: index === 0
        ? `Start gently so the trip reflects the ${request.travelerProfile.pace} pace instead of front-loading logistics.`
        : activity.reasonToRecommend,
      reservationSuggested: false,
    },
    afternoon: {
      title: activity.name,
      venue: activity.name,
      note: activity.reasonToRecommend,
      reservationSuggested: activity.category === "museum",
    },
    evening: {
      title: dinner.name,
      venue: dinner.name,
      note: dinner.reasonToRecommend,
      reservationSuggested: dinner.priceBand.includes("$$$"),
    },
    transitNotes: "Keep neighborhoods clustered to reduce transfers and preserve the feeling of discovery.",
    reservationFlags: [dinner.name],
    budgetEstimate: budgetEstimateFor(request),
  };
}

function createWorkflowContext(request: TripRequest, cityKey = chooseCityKey(request)): WorkflowContext {
  const city = cityCatalog[cityKey];

  return {
    request,
    cityKey,
    city,
    dining: city.dining,
    activities: city.activities,
    lodging: [],
  };
}

function stepResult<T extends z.ZodType<Record<string, unknown>>>(
  step: WorkflowStep,
  summary: string,
  outputSchema: T,
  output: z.input<T>,
  execution: GenerationMetadata,
): WorkflowStepResult {
  return {
    step,
    status: "completed",
    summary,
    output: outputSchema.parse(output),
    execution,
  };
}

function summarizeFallback(error: unknown) {
  const message = error instanceof Error ? error.message : "Provider call failed.";
  return message.length > 180 ? `${message.slice(0, 177)}...` : message;
}

function executionSummary(execution: GenerationMetadata) {
  return execution.live
    ? `Live ${execution.provider} call via ${execution.model}.`
    : `Mock fallback via ${execution.provider}. ${execution.fallbackReason ?? "No provider output was used."}`;
}

async function runStep<T extends z.ZodTypeAny>(
  request: TripRequest,
  step: WorkflowStep,
  schemaName: string,
  schema: T,
  systemPrompt: string,
  userPrompt: string,
  mockFactory: () => z.infer<T>,
): Promise<StepExecution<z.infer<T>>> {
  const adapter = getProviderAdapter(request.provider);

  if (!adapter.isConfigured()) {
    return {
      output: schema.parse(mockFactory()),
      execution: {
        provider: request.provider,
        model: adapter.model,
        live: false,
        fallbackReason: `${request.provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY"} is not configured.`,
      },
    };
  }

  try {
    const generated = await adapter.generateObject(
      {
        request,
        step,
        systemPrompt,
        userPrompt,
        schemaName,
      },
      schema,
    );

    return {
      output: schema.parse(generated.data),
      execution: {
        provider: generated.provider,
        model: generated.model,
        live: generated.live,
        fallbackReason: null,
      },
    };
  } catch (error) {
    return {
      output: schema.parse(mockFactory()),
      execution: {
        provider: request.provider,
        model: adapter.model,
        live: false,
        fallbackReason: summarizeFallback(error),
      },
    };
  }
}

function basePlannerBrief(request: TripRequest) {
  return {
    tripType: request.travelerProfile.tripType,
    dates: {
      start: request.travelerProfile.startDate,
      end: request.travelerProfile.endDate,
      flexibility: request.travelerProfile.dateFlexibility,
    },
    destinationIntent: request.travelerProfile.destinationIntent,
    destinationQuery: request.destinationContext.destinationQuery,
    shortlist: request.destinationContext.shortlist,
    budgetBand: request.travelerProfile.budgetBand,
    splurgeTolerance: request.travelerProfile.splurgeTolerance,
    pace: request.travelerProfile.pace,
    interests: request.travelerProfile.interests,
    constraints: [...request.travelerProfile.constraints, ...request.constraints],
    constraintsNotes: request.travelerProfile.constraintsNotes,
    lodgingStyle: request.travelerProfile.lodgingStyle,
    neighborhoodVibe: request.travelerProfile.neighborhoodVibe,
    mustHaves: request.travelerProfile.mustHaves,
    hardNos: request.travelerProfile.hardNos,
    loyaltyPrograms: request.travelerProfile.loyaltyPrograms,
    surpriseTolerance: request.travelerProfile.surpriseTolerance,
  };
}

function mapSelectedPlaces(candidates: readonly PlaceCandidate[], selectedNames: readonly string[]) {
  const normalized = new Set(selectedNames.map((item) => item.toLowerCase()));
  const selected = candidates.filter((candidate) => normalized.has(candidate.name.toLowerCase()));
  return selected.length > 0 ? selected : candidates.slice(0, Math.min(2, candidates.length));
}

function buildProviderVoice(request: TripRequest, generation: GenerationMetadata) {
  if (!generation.live) {
    return "The planner is running in mock mode, so the structure is real but the AI reasoning path is currently simulated.";
  }

  return request.provider === "openai"
    ? "The OpenAI path kept the itinerary tight, structured, and explicit about tradeoffs."
    : "The Claude path leaned into narrative coherence and taste continuity across the trip.";
}

function withGeneratedReason(place: PlaceCandidate, request: TripRequest, listLabel: "dining" | "activities" | "lodging"): PlaceCandidate {
  if (place.reasonToRecommend.trim()) {
    return place;
  }

  const evidence = place.reviewSummary || place.reviewSnippets[0] || `Strong fit for ${request.travelerProfile.interests.slice(0, 2).join(" and ")} priorities.`;
  const framing = listLabel === "lodging"
    ? `Fits the requested ${request.travelerProfile.lodgingStyle} style and ${request.travelerProfile.neighborhoodVibe} neighborhood preference.`
    : `Aligns with a ${request.travelerProfile.pace} trip shaped around ${request.travelerProfile.interests.slice(0, 2).join(" and ")}.`;

  return {
    ...place,
    reasonToRecommend: `${evidence} ${framing}`,
  };
}

function mockProfileOutput(request: TripRequest) {
  return {
    travelerSignal: `${request.travelerProfile.tripType} trip tuned for ${request.travelerProfile.interests.join(", ")}.`,
    constraintsSummary: request.travelerProfile.constraintsNotes || "No extra constraints noted.",
    preferredPace: request.travelerProfile.pace,
  };
}

function mockDestinationOutput(context: WorkflowContext) {
  return {
    cityKey: context.cityKey,
    destinationTitle: context.city.title,
    neighborhood: context.city.neighborhood,
    rationale: context.city.overview,
  };
}

function mockRecommendationOutput(context: WorkflowContext, type: "dining" | "activities") {
  const candidates = type === "dining" ? context.dining : context.activities;
  return {
    selectedNames: candidates.map((place) => place.name).slice(0, 2),
    rationale: type === "dining"
      ? "Prioritized explainable recommendations that match the traveler's budget, mood, and dinner priorities."
      : "Balanced structured stops with enough room for wandering and local texture.",
  };
}

function mockLodgingOutput(request: TripRequest, context: WorkflowContext) {
  const topLodging = context.lodging[0];

  return {
    lodgingName: topLodging?.name ?? `${context.city.neighborhood} House`,
    neighborhood: topLodging?.address ?? context.city.neighborhood,
    rationale: topLodging?.reasonToRecommend
      ?? `Chosen for a ${request.travelerProfile.neighborhoodVibe} base and compatibility with ${request.travelerProfile.lodgingStyle}.`,
  };
}

function mockItineraryOutput(request: TripRequest, dining: readonly PlaceCandidate[], activities: readonly PlaceCandidate[]) {
  return {
    rhythm: `${request.travelerProfile.pace} pacing with clustered neighborhoods and one intentional anchor each evening.`,
    days: Array.from({ length: getDayCount(request) }, (_, index) => buildDay(index, request, dining, activities)),
  };
}

function mockBudgetOutput(request: TripRequest) {
  return {
    budgetBand: request.travelerProfile.budgetBand,
    fitsBudget: true,
    rationale: `The plan stays within the ${request.travelerProfile.budgetBand} band while preserving one stronger experience.`,
  };
}

function mockFinalizeOutput(request: TripRequest) {
  return {
    reviewStrategy: "Google Places is the sole place and review source for the phase-one app, covering restaurants, neighborhoods, hotels, and attractions through one integration.",
    shareSummary: `A ${request.travelerProfile.pace} ${request.travelerProfile.tripType} trip tuned for ${request.travelerProfile.interests.join(", ")} with a ${request.travelerProfile.budgetBand} budget and room for ${request.travelerProfile.mustHaves.toLowerCase()}.`,
  };
}

export async function buildStructuredTrip(request: TripRequest): Promise<Pick<StoredTrip, "workflow" | "plan">> {
  const steps: WorkflowStepResult[] = [];

  const profile = await runStep(
    request,
    "profile",
    "profile_agent_output",
    profileOutputSchema,
    "You are the Profile Agent for an AI trip planner. Normalize onboarding answers into a crisp traveler brief. Stay concrete, concise, and faithful to the input.",
    `Traveler profile:\n${JSON.stringify(basePlannerBrief(request), null, 2)}`,
    () => mockProfileOutput(request),
  );
  steps.push(
    stepResult(
      "profile",
      `Normalized the onboarding answers into a planner brief for downstream agents. ${executionSummary(profile.execution)}`,
      profileOutputSchema,
      profile.output,
      profile.execution,
    ),
  );

  const initialContext = createWorkflowContext(request);
  const destination = await runStep(
    request,
    "destination",
    "destination_agent_output",
    destinationOutputSchema,
    "You are the Destination Agent. Choose the strongest destination from the provided catalog for this traveler. Use only the provided cityKey values and keep the rationale tied to the traveler's needs.",
    `Traveler brief:\n${JSON.stringify(basePlannerBrief(request), null, 2)}\n\nCity catalog:\n${JSON.stringify(Object.entries(cityCatalog).map(([cityKey, city]) => ({
      cityKey,
      title: city.title,
      neighborhood: city.neighborhood,
      overview: city.overview,
      diningHighlights: city.dining.map((place) => place.name),
      activityHighlights: city.activities.map((place) => place.name),
    })), null, 2)}`,
    () => mockDestinationOutput(initialContext),
  );
  steps.push(
    stepResult(
      "destination",
      `Selected ${destination.output.destinationTitle} as the strongest destination fit. ${executionSummary(destination.execution)}`,
      destinationOutputSchema,
      destination.output,
      destination.execution,
    ),
  );

  const context = createWorkflowContext(request, destination.output.cityKey);
  const placesLookup = await fetchGooglePlacesCandidates({
    destinationTitle: destination.output.destinationTitle,
    neighborhood: destination.output.neighborhood,
    travelerProfile: request.travelerProfile,
  });
  const resolvedContext: WorkflowContext = {
    ...context,
    dining: (placesLookup.dining.length > 0 ? placesLookup.dining : context.dining)
      .map((place) => withGeneratedReason(place, request, "dining")),
    activities: (placesLookup.activities.length > 0 ? placesLookup.activities : context.activities)
      .map((place) => withGeneratedReason(place, request, "activities")),
    lodging: (placesLookup.lodging.length > 0 ? placesLookup.lodging : [])
      .map((place) => withGeneratedReason(place, request, "lodging")),
  };
  const dining = await runStep(
    request,
    "dining",
    "dining_agent_output",
    recommendationOutputSchema,
    "You are the Food and Reviews Agent. Pick the best dining candidates from the provided list. Use exact place names from the catalog and explain why they fit the traveler.",
    `Traveler brief:\n${JSON.stringify(basePlannerBrief(request), null, 2)}\n\nChosen destination:\n${JSON.stringify({
      city: resolvedContext.city.title,
      neighborhood: destination.output.neighborhood,
    }, null, 2)}\n\nDining candidates:\n${JSON.stringify(resolvedContext.dining, null, 2)}`,
    () => mockRecommendationOutput(resolvedContext, "dining"),
  );
  steps.push(
    stepResult(
      "dining",
      "Ranked dining recommendations from the normalized place set. " + executionSummary(dining.execution),
      recommendationOutputSchema,
      dining.output,
      dining.execution,
    ),
  );

  const selectedDining = mapSelectedPlaces(resolvedContext.dining, dining.output.selectedNames)
    .map((place) => withGeneratedReason(place, request, "dining"));
  const activities = await runStep(
    request,
    "activities",
    "activities_agent_output",
    recommendationOutputSchema,
    "You are the Activities Agent. Pick the best attractions and experience ideas from the provided candidate list. Use exact place names from the catalog and keep the mix realistic for the stated pace.",
    `Traveler brief:\n${JSON.stringify(basePlannerBrief(request), null, 2)}\n\nChosen destination:\n${JSON.stringify({
      city: resolvedContext.city.title,
      neighborhood: destination.output.neighborhood,
    }, null, 2)}\n\nActivity candidates:\n${JSON.stringify(resolvedContext.activities, null, 2)}`,
    () => mockRecommendationOutput(resolvedContext, "activities"),
  );
  steps.push(
    stepResult(
      "activities",
      "Selected attractions and neighborhood activities that fit the pace and interests. " + executionSummary(activities.execution),
      recommendationOutputSchema,
      activities.output,
      activities.execution,
    ),
  );

  const selectedActivities = mapSelectedPlaces(resolvedContext.activities, activities.output.selectedNames)
    .map((place) => withGeneratedReason(place, request, "activities"));
  const lodging = await runStep(
    request,
    "lodging",
    "lodging_agent_output",
    lodgingOutputSchema,
    "You are the Lodging Agent. Recommend the best home base for this trip. Keep the recommendation neighborhood-first, prefer exact lodging names from the candidate list when available, and explain the fit.",
    `Traveler brief:\n${JSON.stringify(basePlannerBrief(request), null, 2)}\n\nChosen destination:\n${JSON.stringify({
      city: resolvedContext.city.title,
      neighborhood: destination.output.neighborhood,
      overview: resolvedContext.city.overview,
    }, null, 2)}\n\nLodging candidates:\n${JSON.stringify(resolvedContext.lodging, null, 2)}`,
    () => mockLodgingOutput(request, resolvedContext),
  );
  steps.push(
    stepResult(
      "lodging",
      "Chose the home base for the trip. " + executionSummary(lodging.execution),
      lodgingOutputSchema,
      lodging.output,
      lodging.execution,
    ),
  );

  const itinerary = await runStep(
    request,
    "itinerary",
    "itinerary_agent_output",
    itineraryOutputSchema,
    "You are the Itinerary Agent. Build a coherent day-by-day trip using the provided dates, selected dining, selected activities, and traveler preferences. Keep each day realistic, preserve pace, and use the provided dates exactly.",
    `Traveler brief:\n${JSON.stringify(basePlannerBrief(request), null, 2)}\n\nChosen destination:\n${JSON.stringify({
      city: resolvedContext.city.title,
      neighborhood: destination.output.neighborhood,
      overview: resolvedContext.city.overview,
    }, null, 2)}\n\nPlanning dates:\n${JSON.stringify(getPlanningDates(request), null, 2)}\n\nSelected dining:\n${JSON.stringify(selectedDining, null, 2)}\n\nSelected activities:\n${JSON.stringify(selectedActivities, null, 2)}\n\nBudget estimate band per day:\n${budgetEstimateFor(request)}`,
    () => mockItineraryOutput(request, selectedDining, selectedActivities),
  );
  steps.push(
    stepResult(
      "itinerary",
      "Assembled the recommendations into a day-by-day structure. " + executionSummary(itinerary.execution),
      itineraryOutputSchema,
      itinerary.output,
      itinerary.execution,
    ),
  );

  const budget = await runStep(
    request,
    "budget",
    "budget_agent_output",
    budgetOutputSchema,
    "You are the Budget Agent. Evaluate whether the chosen plan fits the stated budget band and splurge tolerance. Be honest about tensions while staying concise.",
    `Traveler brief:\n${JSON.stringify(basePlannerBrief(request), null, 2)}\n\nSelected dining:\n${JSON.stringify(selectedDining, null, 2)}\n\nSelected activities:\n${JSON.stringify(selectedActivities, null, 2)}\n\nLodging recommendation:\n${JSON.stringify(lodging.output, null, 2)}\n\nItinerary rhythm:\n${itinerary.output.rhythm}`,
    () => mockBudgetOutput(request),
  );
  steps.push(
    stepResult(
      "budget",
      "Checked the itinerary against the stated budget. " + executionSummary(budget.execution),
      budgetOutputSchema,
      budget.output,
      budget.execution,
    ),
  );

  const finalize = await runStep(
    request,
    "finalize",
    "finalize_agent_output",
    finalizeOutputSchema,
    "You are the Coordinator Agent. Summarize the final trip in a shareable way and explain the review strategy used for place selection.",
    `Traveler brief:\n${JSON.stringify(basePlannerBrief(request), null, 2)}\n\nDestination:\n${JSON.stringify(destination.output, null, 2)}\n\nDining rationale:\n${JSON.stringify(dining.output, null, 2)}\n\nActivities rationale:\n${JSON.stringify(activities.output, null, 2)}\n\nBudget verdict:\n${JSON.stringify(budget.output, null, 2)}`,
    () => mockFinalizeOutput(request),
  );
  steps.push(
    stepResult(
      "finalize",
      "Composed the final trip plan payload for the client. " + executionSummary(finalize.execution),
      finalizeOutputSchema,
      finalize.output,
      finalize.execution,
    ),
  );

  const generation: GenerationMetadata = {
    provider: request.provider,
    model: steps.find((step) => step.execution.live)?.execution.model ?? steps[0]?.execution.model ?? "mock-planner",
    live: steps.every((step) => step.execution.live),
    fallbackReason: steps.every((step) => step.execution.live)
      ? null
      : Array.from(new Set(steps.map((step) => step.execution.fallbackReason).filter(Boolean))).join(" | "),
  };

  const mapsHandoff = resolvedContext.lodging.find((place) => place.name.toLowerCase() === lodging.output.lodgingName.toLowerCase())?.googleMapsUri
    ?? selectedDining[0]?.googleMapsUri
    ?? selectedActivities[0]?.googleMapsUri
    ?? "https://maps.google.com/";

  const reviewStrategy = placesLookup.live
    ? "Google Places candidate retrieval is live. Dining, activity, and lodging recommendations are ranked from Google Places search results and review snippets, then filtered by the traveler profile."
    : `Google Places candidate retrieval fell back to the mock catalog. ${placesLookup.reason ?? "No live place data was available."}`;

  const workflow: TripWorkflow = {
    id: crypto.randomUUID(),
    status: "completed",
    startedAt: request.createdAt,
    completedAt: new Date().toISOString(),
    steps,
  };

  const plan: TripPlan = {
    provider: request.provider,
    generation,
    destinationSummary: {
      title: destination.output.destinationTitle,
      overview: `${destination.output.rationale} ${buildProviderVoice(request, generation)}`,
    },
    lodgingRecommendation: {
      name: lodging.output.lodgingName,
      neighborhood: lodging.output.neighborhood,
      reason: lodging.output.rationale,
    },
    dailyItinerary: itinerary.output.days,
    diningList: selectedDining,
    activityList: selectedActivities,
    bookingLinks: [
      {
        label: "Open lodging handoff",
        url: "https://www.booking.com/",
      },
      {
        label: "Open maps handoff",
        url: mapsHandoff,
      },
    ],
    reviewStrategy: `${reviewStrategy} ${finalize.output.reviewStrategy}`,
    shareSummary: finalize.output.shareSummary,
    agentTrace: steps.map((step) => ({
      name: `${step.step.charAt(0).toUpperCase()}${step.step.slice(1)} Agent`,
      summary: step.summary,
    })),
  };

  return { workflow, plan };
}

import { z } from "zod";

export const llmProviderSchema = z.enum(["openai", "claude"]);
export const tripTypeSchema = z.enum(["solo", "couple", "family", "friends", "work", "mixed"]);
export const destinationIntentSchema = z.enum(["fixed", "shortlist", "help-me-choose"]);
export const budgetBandSchema = z.enum(["lean", "comfort", "luxury"]);
export const paceSchema = z.enum(["relaxed", "balanced", "packed"]);
export const surpriseToleranceSchema = z.enum(["classic", "balanced", "explorer"]);

export const travelerProfileSchema = z.object({
  tripType: tripTypeSchema,
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  dateFlexibility: z.string(),
  destinationIntent: destinationIntentSchema,
  destinationQuery: z.string(),
  budgetBand: budgetBandSchema,
  splurgeTolerance: z.number().min(0).max(100),
  pace: paceSchema,
  interests: z.array(z.string()),
  constraints: z.array(z.string()),
  constraintsNotes: z.string(),
  lodgingStyle: z.string(),
  neighborhoodVibe: z.string(),
  mustHaves: z.string(),
  hardNos: z.string(),
  loyaltyPrograms: z.string(),
  surpriseTolerance: surpriseToleranceSchema,
});

export const tripRequestSchema = z.object({
  provider: llmProviderSchema,
  travelerProfile: travelerProfileSchema,
  destinationContext: z.object({
    destinationQuery: z.string(),
    shortlist: z.array(z.string()),
  }),
  constraints: z.array(z.string()),
  createdAt: z.string(),
});

export const placeCandidateSchema = z.object({
  name: z.string(),
  source: z.enum(["yelp", "google-places", "foursquare", "mock"]),
  category: z.string(),
  rating: z.number(),
  priceBand: z.string(),
  reviewSnippets: z.array(z.string()).readonly(),
  lat: z.number(),
  lng: z.number(),
  reasonToRecommend: z.string(),
});

export const itineraryBlockSchema = z.object({
  title: z.string(),
  venue: z.string(),
  note: z.string(),
  reservationSuggested: z.boolean(),
});

export const itineraryDaySchema = z.object({
  date: z.string(),
  dateLabel: z.string(),
  morning: itineraryBlockSchema,
  afternoon: itineraryBlockSchema,
  evening: itineraryBlockSchema,
  transitNotes: z.string(),
  reservationFlags: z.array(z.string()).readonly(),
  budgetEstimate: z.string(),
});

export const agentTraceSchema = z.object({
  name: z.string(),
  summary: z.string(),
});

export const bookingLinkSchema = z.object({
  label: z.string(),
  url: z.string().url(),
});

export const tripPlanSchema = z.object({
  provider: llmProviderSchema,
  destinationSummary: z.object({
    title: z.string(),
    overview: z.string(),
  }),
  lodgingRecommendation: z.object({
    name: z.string(),
    neighborhood: z.string(),
    reason: z.string(),
  }),
  dailyItinerary: z.array(itineraryDaySchema).readonly(),
  diningList: z.array(placeCandidateSchema).readonly(),
  activityList: z.array(placeCandidateSchema).readonly(),
  bookingLinks: z.array(bookingLinkSchema).readonly(),
  shareSummary: z.string(),
  reviewStrategy: z.string(),
  agentTrace: z.array(agentTraceSchema).readonly(),
});

export const storedTripSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string(),
  request: tripRequestSchema,
  plan: tripPlanSchema,
});

export type LLMProvider = z.infer<typeof llmProviderSchema>;
export type TripType = z.infer<typeof tripTypeSchema>;
export type DestinationIntent = z.infer<typeof destinationIntentSchema>;
export type BudgetBand = z.infer<typeof budgetBandSchema>;
export type Pace = z.infer<typeof paceSchema>;
export type SurpriseTolerance = z.infer<typeof surpriseToleranceSchema>;
export type TravelerProfile = z.infer<typeof travelerProfileSchema>;
export type TripRequest = z.infer<typeof tripRequestSchema>;
export type PlaceCandidate = z.infer<typeof placeCandidateSchema>;
export type ItineraryBlock = z.infer<typeof itineraryBlockSchema>;
export type ItineraryDay = z.infer<typeof itineraryDaySchema>;
export type AgentTrace = z.infer<typeof agentTraceSchema>;
export type BookingLink = z.infer<typeof bookingLinkSchema>;
export type TripPlan = z.infer<typeof tripPlanSchema>;
export type StoredTrip = z.infer<typeof storedTripSchema>;

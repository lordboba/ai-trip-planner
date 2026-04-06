import { z } from "zod";

export const llmProviderSchema = z.enum(["openai", "claude"]);
export const budgetBandSchema = z.enum(["lean", "comfort", "luxury"]);
export const paceSchema = z.enum(["relaxed", "balanced", "packed"]);

export const placeCandidateSchema = z.object({
  placeId: z.string().optional(),
  name: z.string(),
  source: z.enum(["google-places", "fallback"]),
  category: z.string(),
  rating: z.number(),
  priceBand: z.string(),
  reviewSnippets: z.array(z.string()).readonly(),
  reviewSummary: z.string().optional(),
  address: z.string().optional(),
  lat: z.number(),
  lng: z.number(),
  googleMapsUri: z.string().url().optional(),
  reasonToRecommend: z.string(),
});

export const generationMetadataSchema = z.object({
  provider: llmProviderSchema,
  model: z.string(),
  live: z.boolean(),
  fallbackReason: z.string().nullable(),
});

export type LLMProvider = z.infer<typeof llmProviderSchema>;
export type BudgetBand = z.infer<typeof budgetBandSchema>;
export type Pace = z.infer<typeof paceSchema>;
export type PlaceCandidate = z.infer<typeof placeCandidateSchema>;
export type GenerationMetadata = z.infer<typeof generationMetadataSchema>;

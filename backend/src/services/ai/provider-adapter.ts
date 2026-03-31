import type { ZodType } from "zod";
import type { LLMProvider, TripRequest, WorkflowStep } from "../../domain/trips.ts";

export interface StepGenerationInput {
  request: TripRequest;
  step: WorkflowStep;
  systemPrompt: string;
  userPrompt: string;
  schemaName: string;
}

export interface StepGenerationResult<T> {
  data: T;
  provider: LLMProvider;
  model: string;
  live: boolean;
}

export interface ProviderAdapter {
  readonly provider: LLMProvider;
  readonly model: string;
  isConfigured(): boolean;
  generateObject<T>(input: StepGenerationInput, schema: ZodType<T>): Promise<StepGenerationResult<T>>;
}

import type { ZodType } from "zod";
import type { LLMProvider } from "../../domain/planning.ts";

export interface StepGenerationInput {
  provider: LLMProvider;
  step: string;
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

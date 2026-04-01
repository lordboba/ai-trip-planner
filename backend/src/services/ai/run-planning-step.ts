import { z } from "zod";
import type { GenerationMetadata, LLMProvider } from "../../domain/planning.ts";
import { getProviderAdapter } from "./adapter-factory.ts";

function summarizeFallback(error: unknown) {
  const message = error instanceof Error ? error.message : "Provider call failed.";
  return message.length > 180 ? `${message.slice(0, 177)}...` : message;
}

export async function runPlanningStep<T extends z.ZodTypeAny>(input: {
  provider: LLMProvider;
  step: string;
  schemaName: string;
  schema: T;
  systemPrompt: string;
  userPrompt: string;
  fallbackFactory: () => z.infer<T>;
}): Promise<{ output: z.infer<T>; execution: GenerationMetadata }> {
  const adapter = getProviderAdapter(input.provider);

  if (!adapter.isConfigured()) {
    return {
      output: input.schema.parse(input.fallbackFactory()),
      execution: {
        provider: input.provider,
        model: adapter.model,
        live: false,
        fallbackReason: `${input.provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY"} is not configured.`,
      },
    };
  }

  try {
    const generated = await adapter.generateObject(
      {
        provider: input.provider,
        step: input.step,
        systemPrompt: input.systemPrompt,
        userPrompt: input.userPrompt,
        schemaName: input.schemaName,
      },
      input.schema,
    );

    return {
      output: input.schema.parse(generated.data),
      execution: {
        provider: generated.provider,
        model: generated.model,
        live: generated.live,
        fallbackReason: null,
      },
    };
  } catch (error) {
    return {
      output: input.schema.parse(input.fallbackFactory()),
      execution: {
        provider: input.provider,
        model: adapter.model,
        live: false,
        fallbackReason: summarizeFallback(error),
      },
    };
  }
}

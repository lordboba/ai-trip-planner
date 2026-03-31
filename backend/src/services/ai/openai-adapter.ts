import { z, type ZodType } from "zod";
import type { ProviderAdapter, StepGenerationInput, StepGenerationResult } from "./provider-adapter.ts";

const openAIResponseSchema = z.object({
  model: z.string().optional(),
  output_text: z.string().optional(),
  output: z
    .array(
      z.object({
        type: z.string(),
        content: z
          .array(
            z.object({
              type: z.string(),
              text: z.string().optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
});

function getJsonText(payload: z.infer<typeof openAIResponseSchema>) {
  if (payload.output_text?.trim()) {
    return payload.output_text;
  }

  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if ((content.type === "output_text" || content.type === "text") && content.text?.trim()) {
        return content.text;
      }
    }
  }

  throw new Error("OpenAI response did not include structured text output.");
}

export class OpenAIProviderAdapter implements ProviderAdapter {
  readonly provider = "openai" as const;
  readonly model = process.env.OPENAI_MODEL?.trim() || "gpt-5-mini";

  isConfigured() {
    return Boolean(process.env.OPENAI_API_KEY?.trim());
  }

  async generateObject<T>(input: StepGenerationInput, schema: ZodType<T>): Promise<StepGenerationResult<T>> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();

    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured.");
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        instructions: input.systemPrompt,
        input: input.userPrompt,
        max_output_tokens: 1600,
        text: {
          format: {
            type: "json_schema",
            name: input.schemaName,
            strict: true,
            schema: z.toJSONSchema(schema),
          },
        },
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed with status ${response.status}: ${await response.text()}`);
    }

    const payload = openAIResponseSchema.parse(await response.json());
    const parsed = schema.parse(JSON.parse(getJsonText(payload)));

    return {
      data: parsed,
      provider: this.provider,
      model: payload.model ?? this.model,
      live: true,
    };
  }
}

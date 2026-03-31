import { z, type ZodType } from "zod";
import type { ProviderAdapter, StepGenerationInput, StepGenerationResult } from "./provider-adapter.ts";

const anthropicResponseSchema = z.object({
  model: z.string().optional(),
  content: z.array(
    z.object({
      type: z.string(),
      name: z.string().optional(),
      text: z.string().optional(),
      input: z.record(z.string(), z.unknown()).optional(),
    }),
  ),
});

function extractJsonFromText(text: string) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const objectMatch = text.match(/\{[\s\S]*\}$/);
  if (objectMatch?.[0]) return objectMatch[0];

  throw new Error("Claude response did not include a parseable JSON object.");
}

export class AnthropicProviderAdapter implements ProviderAdapter {
  readonly provider = "claude" as const;
  readonly model = process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-20250514";

  isConfigured() {
    return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  }

  async generateObject<T>(input: StepGenerationInput, schema: ZodType<T>): Promise<StepGenerationResult<T>> {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();

    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not configured.");
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1600,
        system: `${input.systemPrompt}\nReturn your answer by calling the submit_step_output tool exactly once.`,
        messages: [
          {
            role: "user",
            content: input.userPrompt,
          },
        ],
        tools: [
          {
            name: "submit_step_output",
            description: "Return the final structured output for this planning step.",
            input_schema: z.toJSONSchema(schema),
          },
        ],
        tool_choice: {
          type: "tool",
          name: "submit_step_output",
        },
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!response.ok) {
      throw new Error(`Anthropic request failed with status ${response.status}: ${await response.text()}`);
    }

    const payload = anthropicResponseSchema.parse(await response.json());
    const toolUse = payload.content.find((item) => item.type === "tool_use" && item.name === "submit_step_output");

    if (toolUse?.input) {
      return {
        data: schema.parse(toolUse.input),
        provider: this.provider,
        model: payload.model ?? this.model,
        live: true,
      };
    }

    const textBlock = payload.content.find((item) => item.type === "text" && item.text?.trim());

    if (!textBlock?.text) {
      throw new Error("Claude response did not include structured tool output.");
    }

    return {
      data: schema.parse(JSON.parse(extractJsonFromText(textBlock.text))),
      provider: this.provider,
      model: payload.model ?? this.model,
      live: true,
    };
  }
}

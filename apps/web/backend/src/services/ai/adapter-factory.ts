import type { LLMProvider } from "../../domain/planning.ts";
import type { ProviderAdapter } from "./provider-adapter.ts";
import { AnthropicProviderAdapter } from "./anthropic-adapter.ts";
import { OpenAIProviderAdapter } from "./openai-adapter.ts";

const adapters: Record<LLMProvider, ProviderAdapter> = {
  openai: new OpenAIProviderAdapter(),
  claude: new AnthropicProviderAdapter(),
};

export function getProviderAdapter(provider: LLMProvider) {
  return adapters[provider];
}

import { GeminiProvider } from "./provider-gemini";
import { OpenAIProvider } from "./provider-openai";
import type { ImageGenerationProvider, ProviderName } from "./types";

export function getProvider(
	name: ProviderName,
	env: CloudflareBindings,
): ImageGenerationProvider {
	switch (name) {
		case "openai":
			return new OpenAIProvider(env.OPENAI_API_KEY);
		case "gemini":
			return new GeminiProvider(env.GEMINI_API_KEY);
		default:
			throw new Error(`Unknown image provider: ${name}`);
	}
}

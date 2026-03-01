import type { StyleMode } from "./prompts";

export type ProviderName = "openai" | "gemini";

export type SupportedMimeType = "image/png" | "image/jpeg" | "image/webp";

export interface ImageGenerationProvider {
	generateStylizedDog(
		originalImage: ArrayBuffer,
		originalMimeType: SupportedMimeType,
		referenceImage: ArrayBuffer,
		referenceMimeType: SupportedMimeType,
		styleMode: StyleMode,
	): Promise<ArrayBuffer>;
	compositeIntoLogo(
		stylizedDog: ArrayBuffer,
		referenceImage: ArrayBuffer,
		referenceMimeType: SupportedMimeType,
		styleMode: StyleMode,
	): Promise<ArrayBuffer>;
}

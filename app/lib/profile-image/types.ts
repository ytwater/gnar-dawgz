export type ProviderName = "openai" | "gemini";

export interface ImageGenerationProvider {
	generateStylizedDog(
		originalImage: ArrayBuffer,
		referenceImage: ArrayBuffer,
	): Promise<ArrayBuffer>;
	compositeIntoLogo(
		stylizedDog: ArrayBuffer,
		referenceImage: ArrayBuffer,
	): Promise<ArrayBuffer>;
}

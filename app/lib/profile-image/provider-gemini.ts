import { LOGO_COMPOSITE_PROMPT, STYLIZED_DOG_PROMPT } from "./prompts";
import type { ImageGenerationProvider } from "./types";

const GEMINI_API_URL =
	"https://generativelanguage.googleapis.com/v1beta/models/imagen-4:generateContent";

export class GeminiProvider implements ImageGenerationProvider {
	private apiKey: string;

	constructor(apiKey: string) {
		this.apiKey = apiKey;
	}

	async generateStylizedDog(
		originalImage: ArrayBuffer,
		referenceImage: ArrayBuffer,
	): Promise<ArrayBuffer> {
		return this.generate(STYLIZED_DOG_PROMPT, [originalImage, referenceImage]);
	}

	async compositeIntoLogo(
		stylizedDog: ArrayBuffer,
		referenceImage: ArrayBuffer,
	): Promise<ArrayBuffer> {
		return this.generate(LOGO_COMPOSITE_PROMPT, [stylizedDog, referenceImage]);
	}

	private async generate(
		prompt: string,
		images: ArrayBuffer[],
	): Promise<ArrayBuffer> {
		const imageParts = images.map((img) => ({
			inlineData: {
				mimeType: "image/png",
				data: arrayBufferToBase64(img),
			},
		}));

		const response = await fetch(`${GEMINI_API_URL}?key=${this.apiKey}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				contents: [
					{
						parts: [{ text: prompt }, ...imageParts],
					},
				],
				generationConfig: {
					responseModalities: ["IMAGE"],
					imageMimeType: "image/png",
				},
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Gemini API error: ${response.status} ${errorText}`);
		}

		const data = (await response.json()) as {
			candidates?: Array<{
				content?: {
					parts?: Array<{
						inlineData?: { data: string; mimeType: string };
					}>;
				};
			}>;
		};

		const imageData =
			data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)
				?.inlineData?.data;

		if (!imageData) {
			throw new Error("Gemini did not return image data");
		}

		return base64ToArrayBuffer(imageData);
	}
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = "";
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
	const binaryString = atob(base64);
	const bytes = new Uint8Array(binaryString.length);
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes.buffer;
}

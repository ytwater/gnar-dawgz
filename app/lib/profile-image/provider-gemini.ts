import {
	type StyleMode,
	getLogoCompositePrompt,
	getStylizedDogPrompt,
} from "./prompts";
import type { ImageGenerationProvider, SupportedMimeType } from "./types";

const GEMINI_API_BASE =
	"https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODEL = "gemini-2.5-flash-image";

export class GeminiProvider implements ImageGenerationProvider {
	private apiKey: string;

	constructor(apiKey: string) {
		this.apiKey = apiKey;
	}

	async generateStylizedDog(
		originalImage: ArrayBuffer,
		originalMimeType: SupportedMimeType,
		referenceImage: ArrayBuffer,
		referenceMimeType: SupportedMimeType,
		styleMode: StyleMode,
	): Promise<ArrayBuffer> {
		return this.generate(getStylizedDogPrompt(styleMode), [
			{ data: originalImage, mimeType: originalMimeType },
			{ data: referenceImage, mimeType: referenceMimeType },
		]);
	}

	async compositeIntoLogo(
		stylizedDog: ArrayBuffer,
		referenceImage: ArrayBuffer,
		referenceMimeType: SupportedMimeType,
		styleMode: StyleMode,
	): Promise<ArrayBuffer> {
		return this.generate(getLogoCompositePrompt(styleMode), [
			{ data: stylizedDog, mimeType: "image/png" },
			{ data: referenceImage, mimeType: referenceMimeType },
		]);
	}

	private async generate(
		prompt: string,
		images: Array<{ data: ArrayBuffer; mimeType: string }>,
	): Promise<ArrayBuffer> {
		const imageParts = images.map((img) => ({
			inlineData: {
				mimeType: img.mimeType,
				data: arrayBufferToBase64(img.data),
			},
		}));

		const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${this.apiKey}`;

		const response = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				contents: [
					{
						parts: [{ text: prompt }, ...imageParts],
					},
				],
				generationConfig: {
					responseModalities: ["TEXT", "IMAGE"],
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
						text?: string;
						inlineData?: { data: string; mimeType: string };
					}>;
				};
			}>;
		};

		const imagePart = data.candidates?.[0]?.content?.parts?.find(
			(p) => p.inlineData,
		);

		if (!imagePart?.inlineData?.data) {
			throw new Error("Gemini did not return image data");
		}

		return base64ToArrayBuffer(imagePart.inlineData.data);
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

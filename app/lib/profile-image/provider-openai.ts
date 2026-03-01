import OpenAI, { toFile } from "openai";
import {
	type StyleMode,
	getLogoCompositePrompt,
	getStylizedDogPrompt,
} from "./prompts";
import type { ImageGenerationProvider, SupportedMimeType } from "./types";

const MIME_TO_EXT: Record<SupportedMimeType, string> = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/webp": "webp",
};

export class OpenAIProvider implements ImageGenerationProvider {
	private client: OpenAI;

	constructor(apiKey: string) {
		this.client = new OpenAI({ apiKey });
	}

	async generateStylizedDog(
		originalImage: ArrayBuffer,
		originalMimeType: SupportedMimeType,
		referenceImage: ArrayBuffer,
		referenceMimeType: SupportedMimeType,
		styleMode: StyleMode,
	): Promise<ArrayBuffer> {
		const dogFile = await toFile(
			new Blob([originalImage], { type: originalMimeType }),
			`dog.${MIME_TO_EXT[originalMimeType]}`,
			{ type: originalMimeType },
		);
		const refFile = await toFile(
			new Blob([referenceImage], { type: referenceMimeType }),
			`reference.${MIME_TO_EXT[referenceMimeType]}`,
			{ type: referenceMimeType },
		);

		const response = await this.client.images.edit({
			model: "gpt-image-1",
			image: [dogFile, refFile],
			prompt: getStylizedDogPrompt(styleMode),
			size: "1024x1024",
			quality: "high",
			background: "transparent",
		});

		const imageData = response.data?.[0];
		if (!imageData?.b64_json) {
			throw new Error("OpenAI did not return image data");
		}

		return base64ToArrayBuffer(imageData.b64_json);
	}

	async compositeIntoLogo(
		stylizedDog: ArrayBuffer,
		referenceImage: ArrayBuffer,
		referenceMimeType: SupportedMimeType,
		styleMode: StyleMode,
	): Promise<ArrayBuffer> {
		const dogFile = await toFile(
			new Blob([stylizedDog], { type: "image/png" }),
			"stylized-dog.png",
			{ type: "image/png" },
		);
		const refFile = await toFile(
			new Blob([referenceImage], { type: referenceMimeType }),
			`reference.${MIME_TO_EXT[referenceMimeType]}`,
			{ type: referenceMimeType },
		);

		const response = await this.client.images.edit({
			model: "gpt-image-1",
			image: [dogFile, refFile],
			prompt: getLogoCompositePrompt(styleMode),
			size: "1024x1024",
			quality: "high",
			background: "transparent",
		});

		const imageData = response.data?.[0];
		if (!imageData?.b64_json) {
			throw new Error("OpenAI did not return image data");
		}

		return base64ToArrayBuffer(imageData.b64_json);
	}
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
	const binaryString = atob(base64);
	const bytes = new Uint8Array(binaryString.length);
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes.buffer;
}

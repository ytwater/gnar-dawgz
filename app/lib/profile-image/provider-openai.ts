import OpenAI, { toFile } from "openai";
import { LOGO_COMPOSITE_PROMPT, STYLIZED_DOG_PROMPT } from "./prompts";
import type { ImageGenerationProvider } from "./types";

export class OpenAIProvider implements ImageGenerationProvider {
	private client: OpenAI;

	constructor(apiKey: string) {
		this.client = new OpenAI({ apiKey });
	}

	async generateStylizedDog(
		originalImage: ArrayBuffer,
		referenceImage: ArrayBuffer,
	): Promise<ArrayBuffer> {
		const dogFile = await toFile(
			new Blob([originalImage], { type: "image/png" }),
			"dog.png",
		);
		const refFile = await toFile(
			new Blob([referenceImage], { type: "image/png" }),
			"reference.png",
		);

		const response = await this.client.images.edit({
			model: "gpt-image-1",
			image: [dogFile, refFile],
			prompt: STYLIZED_DOG_PROMPT,
			size: "1024x1024",
			quality: "high",
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
	): Promise<ArrayBuffer> {
		const dogFile = await toFile(
			new Blob([stylizedDog], { type: "image/png" }),
			"stylized-dog.png",
		);
		const refFile = await toFile(
			new Blob([referenceImage], { type: "image/png" }),
			"reference.png",
		);

		const response = await this.client.images.edit({
			model: "gpt-image-1",
			image: [dogFile, refFile],
			prompt: LOGO_COMPOSITE_PROMPT,
			size: "1024x1024",
			quality: "high",
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

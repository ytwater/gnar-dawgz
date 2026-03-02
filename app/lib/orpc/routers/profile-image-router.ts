import { generateId } from "ai";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { logAiUsage } from "../../ai-cost-utils";
import { getProvider } from "../../profile-image/get-provider";
import type {
	ProviderName,
	SupportedMimeType,
} from "../../profile-image/types";
import { profileImages, users } from "../../schema";
import { authedProcedure } from "../server";

export const profileImageRouter = {
	upload: authedProcedure
		.input(
			z.object({
				imageData: z.string(), // base64
				fileName: z.string(),
				mimeType: z.string(),
			}),
		)
		.handler(async ({ input, context }) => {
			const userId = context.session.user.id;
			const id = generateId();

			console.log("[profile-image:upload] Starting upload", {
				userId,
				id,
				fileName: input.fileName,
				mimeType: input.mimeType,
				imageDataLength: input.imageData.length,
			});

			// Decode base64 to binary
			let bytes: Uint8Array;
			try {
				const binaryString = atob(input.imageData);
				bytes = new Uint8Array(binaryString.length);
				for (let i = 0; i < binaryString.length; i++) {
					bytes[i] = binaryString.charCodeAt(i);
				}
				console.log("[profile-image:upload] Decoded base64", {
					byteLength: bytes.length,
				});
			} catch (err) {
				console.error("[profile-image:upload] Failed to decode base64", err);
				throw new Error("Invalid image data");
			}

			// Store original in R2
			const key = `profiles/${userId}/${id}/original.png`;
			try {
				await context.env.PROFILE_IMAGES_BUCKET.put(key, bytes.buffer, {
					httpMetadata: { contentType: input.mimeType },
				});
				console.log("[profile-image:upload] Stored in R2", { key });
			} catch (err) {
				console.error("[profile-image:upload] R2 put failed", err);
				throw new Error("Failed to store image");
			}

			// Create DB record
			try {
				await context.db.insert(profileImages).values({
					id,
					userId,
					originalUrl: key,
					provider: context.env.IMAGE_PROVIDER || "openai",
					status: "pending",
					createdAt: new Date(),
					updatedAt: new Date(),
				});
				console.log("[profile-image:upload] DB record created", { id });
			} catch (err) {
				console.error("[profile-image:upload] DB insert failed", err);
				throw new Error("Failed to create image record");
			}

			return { id };
		}),

	generate: authedProcedure
		.input(
			z.object({
				profileImageId: z.string(),
				provider: z.enum(["openai", "gemini"]).optional(),
				styleMode: z.enum(["head", "full"]).default("head"),
			}),
		)
		.handler(async ({ input, context }) => {
			const userId = context.session.user.id;
			const providerName =
				input.provider || context.env.IMAGE_PROVIDER || "gemini";
			const { profileImageId, styleMode } = input;

			console.log("[profile-image:generate] Starting generation", {
				userId,
				profileImageId,
				provider: providerName,
			});

			// Verify ownership
			const [image] = await context.db
				.select()
				.from(profileImages)
				.where(
					and(
						eq(profileImages.id, profileImageId),
						eq(profileImages.userId, userId),
					),
				)
				.limit(1);

			if (!image) {
				throw new Error("Profile image not found");
			}

			// Set status to processing and update provider
			await context.db
				.update(profileImages)
				.set({
					status: "processing",
					provider: providerName,
					errorMessage: null,
					updatedAt: new Date(),
				})
				.where(eq(profileImages.id, profileImageId));

			try {
				// Get original image from R2
				console.log("[profile-image:generate] Fetching original from R2", {
					key: image.originalUrl,
				});
				const originalObj = await context.env.PROFILE_IMAGES_BUCKET.get(
					image.originalUrl,
				);
				if (!originalObj) {
					throw new Error("Original image not found in storage");
				}
				const originalBuffer = await originalObj.arrayBuffer();
				const originalMimeType = (originalObj.httpMetadata?.contentType ||
					"image/png") as SupportedMimeType;

				// Get reference logo
				const referenceObj = await context.env.PROFILE_IMAGES_BUCKET.get(
					"reference-logo.webp",
				);
				let referenceBuffer: ArrayBuffer;
				let referenceMimeType: SupportedMimeType = "image/webp";

				if (referenceObj) {
					referenceBuffer = await referenceObj.arrayBuffer();
					referenceMimeType = (referenceObj.httpMetadata?.contentType ||
						"image/webp") as SupportedMimeType;
				} else {
					// Fetch from app origin and cache in R2
					const logoResponse = await fetch(
						"https://www.gnardawgs.surf/gnar-dawgs-logo-transparent.webp",
					);
					if (!logoResponse.ok) {
						throw new Error("Failed to fetch reference logo");
					}
					referenceBuffer = await logoResponse.arrayBuffer();
					await context.env.PROFILE_IMAGES_BUCKET.put(
						"reference-logo.webp",
						referenceBuffer,
						{ httpMetadata: { contentType: "image/webp" } },
					);
				}

				// Get AI provider
				console.log("[profile-image:generate] Getting AI provider", {
					provider: providerName,
				});
				const aiProvider = getProvider(
					providerName as ProviderName,
					context.env,
				);

				// Step 1: Generate stylized dog
				console.log("[profile-image:generate] Step 1: Generating stylized dog");
				const stylizedDogBuffer = await aiProvider.generateStylizedDog(
					originalBuffer,
					originalMimeType,
					referenceBuffer,
					referenceMimeType,
					styleMode,
				);

				// Store stylized dog in R2
				const stylizedDogKey = `profiles/${userId}/${profileImageId}/stylized-dog.png`;
				console.log("[profile-image:generate] Storing stylized dog in R2", {
					key: stylizedDogKey,
					byteLength: stylizedDogBuffer.byteLength,
				});
				await context.env.PROFILE_IMAGES_BUCKET.put(
					stylizedDogKey,
					stylizedDogBuffer,
					{ httpMetadata: { contentType: "image/png" } },
				);

				// Step 2: Composite into logo
				console.log("[profile-image:generate] Step 2: Compositing into logo");
				const fullLogoBuffer = await aiProvider.compositeIntoLogo(
					stylizedDogBuffer,
					referenceBuffer,
					referenceMimeType,
					styleMode,
				);

				// Store full logo in R2
				const fullLogoKey = `profiles/${userId}/${profileImageId}/full-logo.png`;
				await context.env.PROFILE_IMAGES_BUCKET.put(
					fullLogoKey,
					fullLogoBuffer,
					{ httpMetadata: { contentType: "image/png" } },
				);

				console.log("[profile-image:generate] Stored full logo in R2", {
					key: fullLogoKey,
					byteLength: fullLogoBuffer.byteLength,
				});

				await context.db
					.update(profileImages)
					.set({
						stylizedDogUrl: stylizedDogKey,
						fullLogoUrl: fullLogoKey,
						status: "completed",
						updatedAt: new Date(),
					})
					.where(eq(profileImages.id, profileImageId));

				// Log AI usage. We use 2 images for head/full modes (stylized + composite)
				const modelId =
					providerName === "gemini"
						? "google/gemini-2.0-flash-exp"
						: "openai/dall-e-3";

				await logAiUsage(context.db, {
					userId,
					modelId,
					feature: "profile_creator",
					imagesGenerated: 2,
				});

				return { success: true };
			} catch (error) {
				console.error("[profile-image:generate] Generation failed", error);
				const errorMessage =
					error instanceof Error ? error.message : "Unknown error";

				await context.db
					.update(profileImages)
					.set({
						status: "failed",
						errorMessage,
						updatedAt: new Date(),
					})
					.where(eq(profileImages.id, profileImageId));

				throw error;
			}
		}),

	list: authedProcedure.handler(async ({ context }) => {
		const userId = context.session.user.id;

		return await context.db
			.select()
			.from(profileImages)
			.where(eq(profileImages.userId, userId))
			.orderBy(desc(profileImages.createdAt));
	}),

	get: authedProcedure
		.input(z.object({ id: z.string() }))
		.handler(async ({ input, context }) => {
			const userId = context.session.user.id;

			const [image] = await context.db
				.select()
				.from(profileImages)
				.where(
					and(eq(profileImages.id, input.id), eq(profileImages.userId, userId)),
				)
				.limit(1);

			if (!image) {
				throw new Error("Profile image not found");
			}

			return image;
		}),

	setActive: authedProcedure
		.input(z.object({ id: z.string() }))
		.handler(async ({ input, context }) => {
			const userId = context.session.user.id;

			// Verify ownership and completion
			const [image] = await context.db
				.select()
				.from(profileImages)
				.where(
					and(eq(profileImages.id, input.id), eq(profileImages.userId, userId)),
				)
				.limit(1);

			if (!image) {
				throw new Error("Profile image not found");
			}

			if (image.status !== "completed") {
				throw new Error("Can only set completed images as active");
			}

			// Clear all active flags for this user
			await context.db
				.update(profileImages)
				.set({ isActive: false, updatedAt: new Date() })
				.where(eq(profileImages.userId, userId));

			// Set this one as active
			await context.db
				.update(profileImages)
				.set({ isActive: true, updatedAt: new Date() })
				.where(eq(profileImages.id, input.id));

			// Update users.image to the stylized dog URL (served via our image route)
			if (image.stylizedDogUrl) {
				await context.db
					.update(users)
					.set({
						image: `/api/profile-image/${image.stylizedDogUrl}`,
						updatedAt: new Date(),
					})
					.where(eq(users.id, userId));
			}

			return { success: true };
		}),

	delete: authedProcedure
		.input(z.object({ id: z.string() }))
		.handler(async ({ input, context }) => {
			const userId = context.session.user.id;

			// Verify ownership
			const [image] = await context.db
				.select()
				.from(profileImages)
				.where(
					and(eq(profileImages.id, input.id), eq(profileImages.userId, userId)),
				)
				.limit(1);

			if (!image) {
				throw new Error("Profile image not found");
			}

			// Delete R2 objects
			const keysToDelete = [image.originalUrl];
			if (image.stylizedDogUrl) keysToDelete.push(image.stylizedDogUrl);
			if (image.fullLogoUrl) keysToDelete.push(image.fullLogoUrl);

			await Promise.all(
				keysToDelete.map((key) =>
					context.env.PROFILE_IMAGES_BUCKET.delete(key),
				),
			);

			// If this was the active image, clear users.image
			if (image.isActive) {
				await context.db
					.update(users)
					.set({ image: null, updatedAt: new Date() })
					.where(eq(users.id, userId));
			}

			// Delete DB row
			await context.db
				.delete(profileImages)
				.where(eq(profileImages.id, input.id));

			return { success: true };
		}),
};

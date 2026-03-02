import { generateId } from "ai";
import { eq } from "drizzle-orm";
import { aiModels, aiUsageLogs } from "./ai-cost-schema";
import type { getDb } from "./db";

export type CostFeature = "profile_creator" | "waha_chat" | "charter_monitor";

export async function logAiUsage(
	db: ReturnType<typeof getDb>,
	params: {
		userId: string;
		modelId: string;
		feature: CostFeature;
		promptTokens?: number;
		completionTokens?: number;
		imagesGenerated?: number;
	},
) {
	const {
		userId,
		modelId,
		feature,
		promptTokens = 0,
		completionTokens = 0,
		imagesGenerated = 0,
	} = params;

	// Get current pricing for this model
	const [model] = await db
		.select()
		.from(aiModels)
		.where(eq(aiModels.id, modelId))
		.limit(1);

	let totalCost = 0;

	if (model) {
		const promptCost = (promptTokens / 1_000_000) * model.promptPrice;
		const completionCost =
			(completionTokens / 1_000_000) * model.completionPrice;
		const imageCost = imagesGenerated * model.imagePrice;
		totalCost = promptCost + completionCost + imageCost;
	} else {
		console.warn(`[logAiUsage] No pricing found for model: ${modelId}`);
	}

	await db.insert(aiUsageLogs).values({
		id: generateId(),
		userId,
		modelId,
		feature,
		promptTokens,
		completionTokens,
		imagesGenerated,
		totalCost,
		createdAt: new Date(),
	});
}

export async function syncAiModelPrices(
	db: ReturnType<typeof getDb>,
	openRouterKey?: string,
) {
	if (!openRouterKey) {
		console.warn(
			"[syncAiModelPrices] No OpenRouter key provided, skipping sync",
		);
		return;
	}

	try {
		const response = await fetch("https://openrouter.ai/api/v1/models");
		if (!response.ok) {
			throw new Error(`OpenRouter API error: ${response.status}`);
		}

		const { data: models } = (await response.json()) as {
			data: Array<{
				id: string;
				pricing: {
					prompt: string;
					completion: string;
					image?: string;
				};
			}>;
		};

		for (const model of models) {
			// Only sync models we care about or that are already in our DB to keep it clean
			// Or we can just upsert everything and filter in the UI
			// Let's upsert everything they provide, it's not many
			await db
				.insert(aiModels)
				.values({
					id: model.id,
					provider: model.id.split("/")[0],
					promptPrice: Number.parseFloat(model.pricing.prompt) * 1_000_000, // OpenRouter gives price per token, we store per 1M for readability
					completionPrice:
						Number.parseFloat(model.pricing.completion) * 1_000_000,
					imagePrice: Number.parseFloat(model.pricing.image || "0"),
					updatedAt: new Date(),
				})
				.onConflictDoUpdate({
					target: aiModels.id,
					set: {
						promptPrice: Number.parseFloat(model.pricing.prompt) * 1_000_000,
						completionPrice:
							Number.parseFloat(model.pricing.completion) * 1_000_000,
						imagePrice: Number.parseFloat(model.pricing.image || "0"),
						updatedAt: new Date(),
					},
				});
		}
	} catch (error) {
		console.error("[syncAiModelPrices] Failed to sync prices", error);
		throw error;
	}
}

// Helper to manually seed some default prices if OpenRouter is unavailable
export async function seedDefaultAiPrices(db: ReturnType<typeof getDb>) {
	const defaults = [
		{
			id: "google/gemini-2.0-flash-exp",
			provider: "google",
			promptPrice: 0,
			completionPrice: 0,
			imagePrice: 0.03, // Estimate for Gemini Imagen
		},
		{
			id: "openai/gpt-4o",
			provider: "openai",
			promptPrice: 2.5,
			completionPrice: 10,
			imagePrice: 0,
		},
		{
			id: "deepseek/deepseek-chat",
			provider: "deepseek",
			promptPrice: 0.14,
			completionPrice: 0.28,
			imagePrice: 0,
		},
	];

	for (const data of defaults) {
		await db
			.insert(aiModels)
			.values({
				...data,
				updatedAt: new Date(),
			})
			.onConflictDoNothing();
	}
}

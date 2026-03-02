import { sql } from "drizzle-orm";
import {
	index,
	integer,
	real,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";
import { users } from "./auth-schema";

export const aiModels = sqliteTable("ai_models", {
	id: text("id").primaryKey(), // e.g., "google/gemini-1.5-pro", "deepseek/deepseek-chat"
	provider: text("provider").notNull(), // e.g., "google", "deepseek", "openai"
	promptPrice: real("prompt_price").notNull().default(0), // Cost per 1M tokens
	completionPrice: real("completion_price").notNull().default(0), // Cost per 1M tokens
	imagePrice: real("image_price").notNull().default(0), // Cost per image
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
});

export const aiUsageLogs = sqliteTable(
	"ai_usage_logs",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		modelId: text("model_id")
			.notNull()
			.references(() => aiModels.id),
		feature: text("feature").notNull(), // e.g., "profile_creator", "waha_chat"
		promptTokens: integer("prompt_tokens"),
		completionTokens: integer("completion_tokens"),
		imagesGenerated: integer("images_generated"),
		totalCost: real("total_cost").notNull(), // Exact cost at time of generation
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
	},
	(table) => ({
		userIdIdx: index("ai_usage_logs_user_id_idx").on(table.userId),
		modelIdIdx: index("ai_usage_logs_model_id_idx").on(table.modelId),
		featureIdx: index("ai_usage_logs_feature_idx").on(table.feature),
	}),
);

import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./auth-schema";

export const profileImages = sqliteTable(
	"profile_images",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		originalUrl: text("original_url").notNull(),
		stylizedDogUrl: text("stylized_dog_url"),
		fullLogoUrl: text("full_logo_url"),
		provider: text("provider").notNull(),
		isActive: integer("is_active", { mode: "boolean" }).default(false),
		status: text("status").notNull().default("pending"),
		errorMessage: text("error_message"),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => ({
		userIdIdx: index("profile_images_user_id_idx").on(table.userId),
		userIdActiveIdx: index("profile_images_user_id_active_idx").on(
			table.userId,
			table.isActive,
		),
	}),
);

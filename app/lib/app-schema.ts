import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./auth-schema";

export const accessRequests = sqliteTable("access_requests", {
	id: text("id").primaryKey(),
	email: text("email").notNull().unique(),
	reason: text("reason").notNull(),
	status: text("status").notNull().default("pending"),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
});

export const whatsappMessages = sqliteTable(
	"whatsapp_messages",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		role: text("role").notNull(), // "user" | "assistant"
		content: text("content").notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
	},
	(table) => ({
		userIdIdx: index("whatsapp_messages_user_id_idx").on(table.userId),
		createdAtIdx: index("whatsapp_messages_created_at_idx").on(table.createdAt),
	}),
);

export const charter = sqliteTable("charter", {
	id: text("id").primaryKey(),
	content: text("content").notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.$onUpdate(() => new Date())
		.notNull(),
	updatedBy: text("updated_by")
		.notNull()
		.references(() => users.id),
});

export const demerits = sqliteTable(
	"demerits",
	{
		id: text("id").primaryKey(),
		fromUserId: text("from_user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		toUserId: text("to_user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		reason: text("reason").notNull(),
		status: text("status").notNull().default("active"), // "active" | "cleared"
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		clearedAt: integer("cleared_at", { mode: "timestamp_ms" }),
	},
	(table) => ({
		fromUserIdIdx: index("demerits_from_user_id_idx").on(table.fromUserId),
		toUserIdIdx: index("demerits_to_user_id_idx").on(table.toUserId),
	}),
);

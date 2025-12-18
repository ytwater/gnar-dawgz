import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const accessRequests = sqliteTable("access_requests", {
	id: text("id").primaryKey(),
	email: text("email").notNull().unique(),
	reason: text("reason").notNull(),
	status: text("status").notNull().default("pending"),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
});

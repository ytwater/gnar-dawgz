import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { surfSpots } from "./surf-forecast-schema";

export const surfReports = sqliteTable(
	"surf_reports",
	{
		id: text("id").primaryKey(),
		surfSpotId: text("surf_spot_id")
			.notNull()
			.references(() => surfSpots.id, { onDelete: "cascade" }),
		report: text("report").notNull(),
		generatedAt: integer("generated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => ({
		spotGeneratedIdx: index("idx_surf_reports_spot_generated").on(
			table.surfSpotId,
			table.generatedAt,
		),
		expiresIdx: index("idx_surf_reports_expires").on(table.expiresAt),
	}),
);
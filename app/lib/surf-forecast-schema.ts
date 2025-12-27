import { sql } from "drizzle-orm";
import {
	index,
	integer,
	real,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const surfSpots = sqliteTable("surf_spots", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	surflineId: text("surfline_id"),
	lat: real("lat").notNull(),
	lng: real("lng").notNull(),
	isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
	lastSyncedAt: integer("last_synced_at", { mode: "timestamp_ms" }),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
});

export const surfTaxonomy = sqliteTable(
	"surf_taxonomy",
	{
		id: text("id").primaryKey(), // Surfline _id
		parentId: text("parent_id"),
		name: text("name").notNull(),
		type: text("type").notNull(), // "spot" | "subregion" | "region"
		spotId: text("spot_id"), // Surfline spot ID if type is "spot"
		lat: real("lat"),
		lng: real("lng"),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
	},
	(table) => ({
		parentIdx: index("surf_taxonomy_parent_idx").on(table.parentId),
		typeIdx: index("surf_taxonomy_type_idx").on(table.type),
	}),
);

export const surfForecasts = sqliteTable(
	"surf_forecasts",
	{
		id: text("id").primaryKey(),
		source: text("source").notNull(), // "surfline" | "swellcloud"
		spotId: text("spot_id")
			.notNull()
			.references(() => surfSpots.id, { onDelete: "cascade" }),
		timestamp: integer("timestamp", { mode: "timestamp_ms" }).notNull(),

		waveHeightMin: real("wave_height_min"),
		waveHeightMax: real("wave_height_max"),
		wavePeriod: real("wave_period"),
		waveDirection: real("wave_direction"),

		windSpeed: real("wind_speed"),
		windDirection: real("wind_direction"),
		temperature: real("temperature"),

		rating: text("rating"), // surfline only: "POOR", "FAIR", etc.

		swells: text("swells"), // JSON string for multiple swell components

		fetchedAt: integer("fetched_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
	},
	(table) => ({
		sourceSpotTimestampIdx: uniqueIndex(
			"surf_forecasts_source_spot_timestamp_idx",
		).on(table.source, table.spotId, table.timestamp),
		timestampIdx: index("surf_forecasts_timestamp_idx").on(table.timestamp),
	}),
);

export const tideForecasts = sqliteTable(
	"tide_forecasts",
	{
		id: text("id").primaryKey(),
		source: text("source").notNull(),
		spotId: text("spot_id")
			.notNull()
			.references(() => surfSpots.id, { onDelete: "cascade" }),
		timestamp: integer("timestamp", { mode: "timestamp_ms" }).notNull(),

		type: text("type"), // "HIGH", "LOW", "NORMAL"
		height: real("height"),

		fetchedAt: integer("fetched_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
	},
	(table) => ({
		sourceSpotTimestampIdx: uniqueIndex(
			"tide_forecasts_source_spot_timestamp_idx",
		).on(table.source, table.spotId, table.timestamp),
		timestampIdx: index("tide_forecasts_timestamp_idx").on(table.timestamp),
	}),
);

CREATE TABLE `surf_spots` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`surfline_id` text,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_surf_forecasts` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`spot_id` text NOT NULL,
	`timestamp` integer NOT NULL,
	`wave_height_min` real,
	`wave_height_max` real,
	`wave_period` real,
	`wave_direction` real,
	`rating` text,
	`swells` text,
	`fetched_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`spot_id`) REFERENCES `surf_spots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_surf_forecasts`("id", "source", "spot_id", "timestamp", "wave_height_min", "wave_height_max", "wave_period", "wave_direction", "rating", "swells", "fetched_at", "created_at") SELECT "id", "source", "spot_id", "timestamp", "wave_height_min", "wave_height_max", "wave_period", "wave_direction", "rating", "swells", "fetched_at", "created_at" FROM `surf_forecasts`;--> statement-breakpoint
DROP TABLE `surf_forecasts`;--> statement-breakpoint
ALTER TABLE `__new_surf_forecasts` RENAME TO `surf_forecasts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `surf_forecasts_source_spot_timestamp_idx` ON `surf_forecasts` (`source`,`spot_id`,`timestamp`);--> statement-breakpoint
CREATE INDEX `surf_forecasts_timestamp_idx` ON `surf_forecasts` (`timestamp`);--> statement-breakpoint
CREATE TABLE `__new_tide_forecasts` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`spot_id` text NOT NULL,
	`timestamp` integer NOT NULL,
	`type` text,
	`height` real,
	`fetched_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`spot_id`) REFERENCES `surf_spots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_tide_forecasts`("id", "source", "spot_id", "timestamp", "type", "height", "fetched_at", "created_at") SELECT "id", "source", "spot_id", "timestamp", "type", "height", "fetched_at", "created_at" FROM `tide_forecasts`;--> statement-breakpoint
DROP TABLE `tide_forecasts`;--> statement-breakpoint
ALTER TABLE `__new_tide_forecasts` RENAME TO `tide_forecasts`;--> statement-breakpoint
CREATE UNIQUE INDEX `tide_forecasts_source_spot_timestamp_idx` ON `tide_forecasts` (`source`,`spot_id`,`timestamp`);--> statement-breakpoint
CREATE INDEX `tide_forecasts_timestamp_idx` ON `tide_forecasts` (`timestamp`);
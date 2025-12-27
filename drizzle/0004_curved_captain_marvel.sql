CREATE TABLE `surf_forecasts` (
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
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `surf_forecasts_source_spot_timestamp_idx` ON `surf_forecasts` (`source`,`spot_id`,`timestamp`);--> statement-breakpoint
CREATE INDEX `surf_forecasts_timestamp_idx` ON `surf_forecasts` (`timestamp`);--> statement-breakpoint
CREATE TABLE `tide_forecasts` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`spot_id` text NOT NULL,
	`timestamp` integer NOT NULL,
	`type` text,
	`height` real,
	`fetched_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tide_forecasts_source_spot_timestamp_idx` ON `tide_forecasts` (`source`,`spot_id`,`timestamp`);--> statement-breakpoint
CREATE INDEX `tide_forecasts_timestamp_idx` ON `tide_forecasts` (`timestamp`);
CREATE TABLE `weather_forecasts` (
	`id` text PRIMARY KEY NOT NULL,
	`spot_id` text NOT NULL,
	`timestamp` integer NOT NULL,
	`temperature` real,
	`precipitation` real,
	`cloud_cover` real,
	`wind_speed` real,
	`wind_direction` real,
	`weather_code` integer,
	`fetched_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`spot_id`) REFERENCES `surf_spots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weather_forecasts_spot_timestamp_idx` ON `weather_forecasts` (`spot_id`,`timestamp`);--> statement-breakpoint
CREATE INDEX `weather_forecasts_timestamp_idx` ON `weather_forecasts` (`timestamp`);
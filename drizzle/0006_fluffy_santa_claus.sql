CREATE TABLE `surf_taxonomy` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`spot_id` text,
	`lat` real,
	`lng` real,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `surf_taxonomy_parent_idx` ON `surf_taxonomy` (`parent_id`);--> statement-breakpoint
CREATE INDEX `surf_taxonomy_type_idx` ON `surf_taxonomy` (`type`);
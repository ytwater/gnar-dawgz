CREATE TABLE `surf_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`surf_spot_id` text NOT NULL,
	`report` text NOT NULL,
	`generated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`surf_spot_id`) REFERENCES `surf_spots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_surf_reports_spot_generated` ON `surf_reports` (`surf_spot_id`, `generated_at`);--> statement-breakpoint
CREATE INDEX `idx_surf_reports_expires` ON `surf_reports` (`expires_at`);
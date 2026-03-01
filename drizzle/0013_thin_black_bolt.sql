CREATE TABLE `profile_images` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`original_url` text NOT NULL,
	`stylized_dog_url` text,
	`full_logo_url` text,
	`provider` text NOT NULL,
	`is_active` integer DEFAULT false,
	`status` text DEFAULT 'pending' NOT NULL,
	`error_message` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `profile_images_user_id_idx` ON `profile_images` (`user_id`);--> statement-breakpoint
CREATE INDEX `profile_images_user_id_active_idx` ON `profile_images` (`user_id`,`is_active`);
CREATE TABLE `ai_models` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`prompt_price` real DEFAULT 0 NOT NULL,
	`completion_price` real DEFAULT 0 NOT NULL,
	`image_price` real DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_usage_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`model_id` text NOT NULL,
	`feature` text NOT NULL,
	`prompt_tokens` integer,
	`completion_tokens` integer,
	`images_generated` integer,
	`total_cost` real NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`model_id`) REFERENCES `ai_models`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ai_usage_logs_user_id_idx` ON `ai_usage_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `ai_usage_logs_model_id_idx` ON `ai_usage_logs` (`model_id`);--> statement-breakpoint
CREATE INDEX `ai_usage_logs_feature_idx` ON `ai_usage_logs` (`feature`);
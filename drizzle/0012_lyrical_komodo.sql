CREATE TABLE `charter_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`proposer_id` text NOT NULL,
	`approver_id` text,
	`proposed_content` text NOT NULL,
	`original_content` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`proposer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`approver_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `charter_proposals_proposer_id_idx` ON `charter_proposals` (`proposer_id`);--> statement-breakpoint
CREATE INDEX `charter_proposals_status_idx` ON `charter_proposals` (`status`);
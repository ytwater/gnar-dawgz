ALTER TABLE `users` ADD `phone_number` text;--> statement-breakpoint
ALTER TABLE `users` ADD `phone_number_verified` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `users_phone_number_unique` ON `users` (`phone_number`);--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `whatsapp_number`;
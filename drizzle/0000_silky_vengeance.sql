CREATE TABLE `progress` (
	`level_id` text PRIMARY KEY NOT NULL,
	`saved` integer NOT NULL,
	`total` integer NOT NULL,
	`percent` integer NOT NULL,
	`completed` integer NOT NULL,
	`ticks` integer NOT NULL,
	`replay` text NOT NULL,
	`updated_at` text NOT NULL
);

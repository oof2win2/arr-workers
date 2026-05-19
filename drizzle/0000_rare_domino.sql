CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`flagged_item_id` integer NOT NULL,
	`scan_run_id` integer NOT NULL,
	`torrent_name` text NOT NULL,
	`torrent_hash` text NOT NULL,
	`category` text NOT NULL,
	`files_deleted` text NOT NULL,
	`triggered_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`flagged_item_id`) REFERENCES `flagged_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scan_run_id`) REFERENCES `scan_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `flagged_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scan_run_id` integer NOT NULL,
	`qbittorrent_instance_id` integer NOT NULL,
	`arr_instance_id` integer,
	`category` text NOT NULL,
	`reason` text NOT NULL,
	`torrent_hash` text,
	`torrent_name` text,
	`torrent_size` integer,
	`torrent_tags` text,
	`files_to_delete` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`dismissed_at` text,
	`approved_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`scan_run_id`) REFERENCES `scan_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`qbittorrent_instance_id`) REFERENCES `instances`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`arr_instance_id`) REFERENCES `instances`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `flagged_items_status_idx` ON `flagged_items` (`status`);--> statement-breakpoint
CREATE INDEX `flagged_items_scan_run_id_idx` ON `flagged_items` (`scan_run_id`);--> statement-breakpoint
CREATE TABLE `instances` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`label` text NOT NULL,
	`url` text NOT NULL,
	`username` text,
	`password` text,
	`api_key` text,
	`download_dir` text,
	`radarr_tag` text DEFAULT 'radarr',
	`sonarr_tag` text DEFAULT 'sonarr',
	`linked_qbittorrent_id` integer,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `library_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scan_run_id` integer NOT NULL,
	`instance_id` integer NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`scan_run_id`) REFERENCES `scan_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instance_id`) REFERENCES `instances`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `scan_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`status` text DEFAULT 'running' NOT NULL,
	`summary` text,
	`triggered_by` text DEFAULT 'manual' NOT NULL
);

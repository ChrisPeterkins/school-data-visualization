CREATE TABLE `data_imports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_name` text NOT NULL,
	`file_type` text NOT NULL,
	`year` integer,
	`test_type` text,
	`level` text,
	`status` text DEFAULT 'pending',
	`records_processed` integer DEFAULT 0,
	`errors` text,
	`imported_at` integer
);
--> statement-breakpoint
CREATE TABLE `districts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`district_id` text NOT NULL,
	`name` text NOT NULL,
	`county` text,
	`intermediate_unit` text,
	`website_url` text,
	`total_enrollment` integer,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `keystone_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`school_id` text,
	`district_id` text,
	`year` integer NOT NULL,
	`subject` text NOT NULL,
	`level` text NOT NULL,
	`grade` integer DEFAULT 11,
	`total_tested` integer,
	`advanced_count` integer,
	`proficient_count` integer,
	`basic_count` integer,
	`below_basic_count` integer,
	`advanced_percent` real,
	`proficient_percent` real,
	`basic_percent` real,
	`below_basic_percent` real,
	`proficient_or_above_percent` real,
	`growth_score` real,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `pssa_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`school_id` text,
	`district_id` text,
	`year` integer NOT NULL,
	`grade` integer,
	`subject` text NOT NULL,
	`level` text NOT NULL,
	`total_tested` integer,
	`advanced_count` integer,
	`proficient_count` integer,
	`basic_count` integer,
	`below_basic_count` integer,
	`advanced_percent` real,
	`proficient_percent` real,
	`basic_percent` real,
	`below_basic_percent` real,
	`proficient_or_above_percent` real,
	`growth_score` real,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `schools` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`school_id` text NOT NULL,
	`district_id` text NOT NULL,
	`name` text NOT NULL,
	`school_type` text,
	`grade_range` text,
	`address` text,
	`city` text,
	`state` text DEFAULT 'PA',
	`zip_code` text,
	`latitude` real,
	`longitude` real,
	`phone_number` text,
	`website_url` text,
	`enrollment` integer,
	`is_charter` integer DEFAULT false,
	`is_active` integer DEFAULT true,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `import_status_idx` ON `data_imports` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `districts_district_id_unique` ON `districts` (`district_id`);--> statement-breakpoint
CREATE INDEX `district_id_idx` ON `districts` (`district_id`);--> statement-breakpoint
CREATE INDEX `district_name_idx` ON `districts` (`name`);--> statement-breakpoint
CREATE INDEX `keystone_school_id_idx` ON `keystone_results` (`school_id`);--> statement-breakpoint
CREATE INDEX `keystone_district_id_idx` ON `keystone_results` (`district_id`);--> statement-breakpoint
CREATE INDEX `keystone_year_idx` ON `keystone_results` (`year`);--> statement-breakpoint
CREATE INDEX `keystone_subject_idx` ON `keystone_results` (`subject`);--> statement-breakpoint
CREATE INDEX `pssa_school_id_idx` ON `pssa_results` (`school_id`);--> statement-breakpoint
CREATE INDEX `pssa_district_id_idx` ON `pssa_results` (`district_id`);--> statement-breakpoint
CREATE INDEX `pssa_year_idx` ON `pssa_results` (`year`);--> statement-breakpoint
CREATE INDEX `pssa_subject_grade_idx` ON `pssa_results` (`subject`,`grade`);--> statement-breakpoint
CREATE UNIQUE INDEX `schools_school_id_unique` ON `schools` (`school_id`);--> statement-breakpoint
CREATE INDEX `school_id_idx` ON `schools` (`school_id`);--> statement-breakpoint
CREATE INDEX `school_district_id_idx` ON `schools` (`district_id`);--> statement-breakpoint
CREATE INDEX `school_name_idx` ON `schools` (`name`);--> statement-breakpoint
CREATE INDEX `school_location_idx` ON `schools` (`latitude`,`longitude`);
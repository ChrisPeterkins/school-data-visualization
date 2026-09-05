-- Migration: add pvaas_results table
-- Captures raw PVAAS growth data (growthMeasure, effectSize, standardError,
-- growthIndex, growthScore) that the old importer was dropping at
-- src/services/pvaasImporter.ts ~line 230. The growth_score value continues to
-- be propagated onto pssa_results/keystone_results for backwards compatibility.

CREATE TABLE IF NOT EXISTS `pvaas_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`level` text NOT NULL,
	`school_id` integer,
	`district_id` integer,
	`aun` text NOT NULL,
	`school_number` text,
	`year` integer NOT NULL,
	`subject` text NOT NULL,
	`grade` integer,
	`growth_measure` real,
	`growth_index` real,
	`effect_size` real,
	`standard_error` real,
	`growth_score` real,
	`source_file` text,
	`imported_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`district_id`) REFERENCES `districts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `pvaas_level_idx` ON `pvaas_results` (`level`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `pvaas_year_idx` ON `pvaas_results` (`year`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `pvaas_subject_idx` ON `pvaas_results` (`subject`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `pvaas_aun_idx` ON `pvaas_results` (`aun`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `pvaas_school_idx` ON `pvaas_results` (`school_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `pvaas_district_idx` ON `pvaas_results` (`district_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `pvaas_composite_idx` ON `pvaas_results` (`level`,`aun`,`school_number`,`year`,`subject`,`grade`);

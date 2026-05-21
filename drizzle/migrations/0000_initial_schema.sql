-- Nova Casino Initial Schema Migration

CREATE TABLE IF NOT EXISTS `users` (
  `id` text PRIMARY KEY NOT NULL,
  `username` text NOT NULL UNIQUE,
  `email` text NOT NULL UNIQUE,
  `password_hash` text,
  `birth_year` integer,
  `birth_month` integer,
  `is_age_verified` integer DEFAULT 0,
  `gold_coins` real DEFAULT 1000,
  `nova_crystals` real DEFAULT 0,
  `vip_tier` text DEFAULT 'Stardust',
  `vip_progress` real DEFAULT 0,
  `total_wagered` real DEFAULT 0,
  `total_won` real DEFAULT 0,
  `games_played` integer DEFAULT 0,
  `sound_enabled` integer DEFAULT 1,
  `chat_enabled` integer DEFAULT 1,
  `self_exclusion_until` text,
  `self_exclusion_removal_requested_at` text,
  `session_limit_minutes` integer,
  `role` text DEFAULT 'user',
  `rakeback_percent` real DEFAULT 0,
  `tos_accepted_at` text,
  `tos_version` text,
  `created_at` text DEFAULT (datetime('now')),
  `google_id` text,
  `discord_id` text
);

CREATE INDEX IF NOT EXISTS `users_email_idx` ON `users` (`email`);
CREATE INDEX IF NOT EXISTS `users_username_idx` ON `users` (`username`);
CREATE INDEX IF NOT EXISTS `users_google_id_idx` ON `users` (`google_id`);
CREATE INDEX IF NOT EXISTS `users_discord_id_idx` ON `users` (`discord_id`);

CREATE TABLE IF NOT EXISTS `amoe_requests` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`),
  `name` text NOT NULL,
  `address` text NOT NULL,
  `status` text DEFAULT 'pending',
  `requested_at` text DEFAULT (datetime('now')),
  `fulfilled_at` text
);

CREATE INDEX IF NOT EXISTS `amoe_user_id_idx` ON `amoe_requests` (`user_id`);

CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` text PRIMARY KEY NOT NULL,
  `admin_id` text NOT NULL REFERENCES `users`(`id`),
  `action` text NOT NULL,
  `target` text NOT NULL,
  `old_value` text,
  `new_value` text,
  `timestamp` text DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS `audit_admin_id_idx` ON `audit_logs` (`admin_id`);
CREATE INDEX IF NOT EXISTS `audit_timestamp_idx` ON `audit_logs` (`timestamp`);

CREATE TABLE IF NOT EXISTS `game_history` (
  `id` text PRIMARY KEY NOT NULL,
  `game_type` text NOT NULL,
  `crash_point` real,
  `server_seed` text,
  `server_seed_hash` text,
  `created_at` text DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS `game_history_type_idx` ON `game_history` (`game_type`);
CREATE INDEX IF NOT EXISTS `game_history_created_at_idx` ON `game_history` (`created_at`);

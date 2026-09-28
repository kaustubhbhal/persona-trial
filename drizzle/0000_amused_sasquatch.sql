CREATE TABLE `persona_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`expires` integer NOT NULL,
	`oauth_state` text,
	`oauth_verifier` text,
	`oauth_expires` integer,
	`credentials` text,
	`turn_lock` text,
	`lock_until` integer DEFAULT 0 NOT NULL
);

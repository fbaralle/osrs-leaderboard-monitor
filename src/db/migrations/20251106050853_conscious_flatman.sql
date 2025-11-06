CREATE TABLE `score_update_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userName` text NOT NULL,
	`score` integer NOT NULL,
	`rank` integer NOT NULL,
	`updatedAtTimestamp` integer NOT NULL
);

CREATE INDEX `idx_username` ON `score_update_events` (`userName`);
CREATE UNIQUE INDEX `idx_unique_user_rank_score` ON `score_update_events` (`userName`,`rank`,`score`);